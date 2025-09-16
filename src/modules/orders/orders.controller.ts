import { Request, Response } from "express";
import { eq, inArray, and } from "drizzle-orm";
import db from "../../common/database/index.js";
import {
  ordersTable,
  reviews,
  userStoriesTable,
  usersTable,
} from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";
import { uploadFile } from "../../common/utils/cloudinary.js";
import { desc } from "drizzle-orm";
import { publishToQueue } from "../email/producers/email.producers.js";
import { shopifyAdminFetch } from "../../utils/shopify-admin-client.js";

class OrdersController {
  async createOrder(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const { shopifyOrderId } = req.body;

      if (!shopifyOrderId) {
        return failureResponse(res, 400, "Shopify Order ID is required");
      }

      const newOrder = {
        userId: userID,
        shopifyOrderId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [createdOrder] = await db
        .insert(ordersTable)
        .values(newOrder)
        .returning();

      return successResponse(
        res,
        201,
        "Order created successfully",
        createdOrder
      );
    } catch (error) {
      console.error("Error creating order:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
  async getUserOrders(req: Request, res: Response) {
    const ORDER_QUERY = `
query getOrder($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    displayFinancialStatus
    displayFulfillmentStatus
    cancelledAt
    
    # Order-level custom attributes
    customAttributes {
      key
      value
    }
    
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          originalTotalSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          
          # Line item custom attributes
          customAttributes {
            key
            value
          }

          variant {
            id
            title
            sku
            image {
              url
            }

            # Variant metafields - using individual metafield queries
            isPreorder: metafield(namespace: "custom", key: "is_preorder") {
              value
            }
            preorderShipDate: metafield(namespace: "custom", key: "preorder_ship_date") {
              value
            }

            product {
              id
              title

              # Product metafields - using individual metafield queries
              isPreorder: metafield(namespace: "custom", key: "is_preorder") {
                value
              }
              preorderShipDate: metafield(namespace: "custom", key: "preorder_ship_date") {
                value
              }
            }
          }
        }
      }
    }
  }
}`;

    const PRODUCT_DETAILS_QUERY = `
    query getProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          description
          handle
          tags
          featuredImage { url }
        }
      }
    }`;

    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }

      // Fetch all local orders
      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.userId, userID))
        .orderBy(desc(ordersTable.createdAt));

      // Step 1: Fetch Shopify order data for each order
      const ordersWithShopifyData = await Promise.all(
        orders.map(async (order) => {
          const shopifyId = `gid://shopify/Order/${order.shopifyOrderId}`;
          const { order: shopifyOrder } = await shopifyAdminFetch(ORDER_QUERY, {
            id: shopifyId,
          });
          return { ...order, shopifyOrder };
        })
      );

      // Step 2: Collect unique product IDs
      const allProductIds = Array.from(
        new Set(
          ordersWithShopifyData.flatMap(({ shopifyOrder }) =>
            shopifyOrder.lineItems.edges
              .map((edge: any) => edge.node.variant?.product?.id)
              .filter(Boolean)
          )
        )
      );

      // Step 3: Fetch product details (batch request)
      let productDetailsMap: Record<string, any> = {};
      if (allProductIds.length > 0) {
        const { nodes } = await shopifyAdminFetch(PRODUCT_DETAILS_QUERY, {
          ids: allProductIds,
        });

        productDetailsMap = nodes.reduce((acc: any, product: any) => {
          if (product) {
            const shortId = product.id.split("/").pop();
            acc[shortId] = {
              id: shortId,
              title: product.title,
              description: product.description,
              tags: product.tags,
              handle: product.handle,
              image: product.featuredImage?.url || null,
            };
          }
          return acc;
        }, {});
      }

      // Step 4: Fetch all reviews by this user for these products
      const shortProductIds = allProductIds.map((gid) => gid.split("/").pop());
      const userReviews = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, userID),
            inArray(reviews.productId, shortProductIds)
          )
        );

      // Step 5: Merge everything
      const ordersWithDetails = ordersWithShopifyData.map(
        ({ shopifyOrder, ...order }) => {
          // Process order-level custom attributes
          const orderCustomAttributes =
            shopifyOrder.customAttributes?.reduce((acc: any, attr: any) => {
              acc[attr.key] = attr.value;
              return acc;
            }, {}) || {};

          return {
            ...order,
            date: shopifyOrder.createdAt,
            total: parseFloat(shopifyOrder.totalPriceSet.shopMoney.amount),
            financialStatus: shopifyOrder.displayFinancialStatus,
            fulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
            cancelledAt: shopifyOrder.cancelledAt,

            // Add order-level custom attributes
            customAttributes: orderCustomAttributes,

            lineItems: shopifyOrder.lineItems.edges.map(({ node }: any) => {
              const shortProductId = node.variant?.product?.id
                ?.split("/")
                .pop();
              const product = shortProductId
                ? productDetailsMap[shortProductId]
                : null;
              const review = shortProductId
                ? userReviews.find((r) => r.productId === shortProductId)
                : null;

              // Extract variant metafields (now they're direct fields)
              const variantIsPreorder = node.variant?.isPreorder?.value;
              const variantPreorderShipDate =
                node.variant?.preorderShipDate?.value;

              // Extract product metafields (now they're direct fields)
              const productIsPreorder =
                node.variant?.product?.isPreorder?.value;
              const productPreorderShipDate =
                node.variant?.product?.preorderShipDate?.value;

              // Process line item custom attributes
              const lineItemCustomAttributes =
                node.customAttributes?.reduce((acc: any, attr: any) => {
                  acc[attr.key] = attr.value;
                  return acc;
                }, {}) || {};

              return {
                id: node.id,
                title: node.title,
                quantity: node.quantity,
                price: parseFloat(node.originalTotalSet.shopMoney.amount),
                variantId: node.variant?.id,
                sku: node.variant?.sku,
                image: node.variant?.image?.url,
                product: product || null,
                review: review
                  ? { id: review.id, score: review.score, text: review.review }
                  : null,

                // Add line item custom attributes
                customAttributes: lineItemCustomAttributes,

                isPreOrder:
                  variantIsPreorder === "true" ||
                  productIsPreorder === "true" ||
                  false,
                preorderShipDate:
                  variantPreorderShipDate || productPreorderShipDate || null,
              };
            }),
          };
        }
      );

      return successResponse(
        res,
        200,
        "User orders fetched successfully",
        ordersWithDetails
      );
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

const ordersController = new OrdersController();
export default ordersController;
