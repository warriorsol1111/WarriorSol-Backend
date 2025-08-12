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
    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.userId, userID))
        .orderBy(desc(ordersTable.createdAt));

      // Step 1: Fetch all Shopify orders
      const ordersWithShopifyData = await Promise.all(
        orders.map(async (order) => {
          const shopifyId = `gid://shopify/Order/${order.shopifyOrderId}`;
          const query = `
query getOrder($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    displayFinancialStatus
    displayFulfillmentStatus
    cancelledAt
    totalPriceSet { shopMoney { amount currencyCode } }
    lineItems(first: 20) {
      edges {
        node {
          id
          title
          quantity
          originalTotalSet { shopMoney { amount currencyCode } }
          variant {
            id
            image { originalSrc }
            product {
              id
            }
          }
        }
      }
    }
  }
}`;
          const shopifyData = await shopifyAdminFetch(query, { id: shopifyId });
          return { ...order, shopifyOrder: shopifyData.order };
        })
      );

      // Step 2: Collect all product IDs from all orders
      const allProductIds = ordersWithShopifyData.flatMap(({ shopifyOrder }) =>
        shopifyOrder.lineItems.edges
          .map(({ node }: any) => node.variant?.product?.id)
          .filter(Boolean)
          .map((gid: string) => gid.split("/").pop())
      );

      // Step 3: Fetch all reviews for those products by this user
      const userReviews = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, userID),
            inArray(reviews.productId, allProductIds)
          )
        );

      // Step 4: Attach reviews to the matching line item
      const ordersWithDetails = ordersWithShopifyData.map(
        ({ shopifyOrder, ...order }) => ({
          ...order,
          date: shopifyOrder.createdAt,
          total: parseFloat(shopifyOrder.totalPriceSet.shopMoney.amount),
          lineItems: shopifyOrder.lineItems.edges.map(({ node }: any) => {
            const shortProductId = node.variant?.product?.id?.split("/").pop();
            const review = userReviews.find(
              (r) => r.productId === shortProductId
            );
            return {
              id: node.id,
              title: node.title,
              quantity: node.quantity,
              price: parseFloat(node.originalTotalSet.shopMoney.amount),
              image: node.variant?.image?.originalSrc,
              productId: shortProductId,
              review: review
                ? { id: review.id, score: review.score, text: review.review }
                : null,
            };
          }),
          financialStatus: shopifyOrder.displayFinancialStatus,
          fulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
          cancelledAt: shopifyOrder.cancelledAt,
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
