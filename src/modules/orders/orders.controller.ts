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
    displayFinancialStatus
    displayFulfillmentStatus
    cancelledAt
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
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
          variant {
            id
            title
            sku
            image {
              url
            }
            product {
              id
              title
            }
          }
        }
      }
    }
  }
}
`;

    // Step 2: GraphQL to fetch product details
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
}
`;
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

      // Step 2: Collect all unique product IDs
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

      // Step 5: Merge everything together
      const ordersWithDetails = ordersWithShopifyData.map(
        ({ shopifyOrder, ...order }) => ({
          ...order,
          date: shopifyOrder.createdAt,
          total: parseFloat(shopifyOrder.totalPriceSet.shopMoney.amount),
          financialStatus: shopifyOrder.displayFinancialStatus,
          fulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
          cancelledAt: shopifyOrder.cancelledAt,
          lineItems: shopifyOrder.lineItems.edges.map(({ node }: any) => {
            const shortProductId = node.variant?.product?.id?.split("/").pop();
            const product = shortProductId
              ? productDetailsMap[shortProductId]
              : null;
            const review = shortProductId
              ? userReviews.find((r) => r.productId === shortProductId)
              : null;

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
            };
          }),
        })
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
