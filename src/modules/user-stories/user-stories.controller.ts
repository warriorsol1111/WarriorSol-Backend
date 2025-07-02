import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import db from "../../common/database/index.js";
import { userStoriesTable } from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";
import { uploadFile } from "../../common/utils/cloudinary.js";

declare module "express" {
  interface Request {
    user?: {
      id: string;
    };
  }
}

class UserStoriesController {
  async getAllUserStories(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const userStories = await db.select().from(userStoriesTable);

      return successResponse(
        res,
        200,
        "User stories fetched successfully",
        userStories
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getApprovedUserStories(req: Request, res: Response) {
    try {
      const userStories = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.status, "approved"));
      return successResponse(
        res,
        200,
        "Approved user stories fetched successfully",
        userStories
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
  async getUserStoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const userStory = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.id, id));
      return successResponse(
        res,
        200,
        "User story fetched successfully",
        userStory
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async createUserStory(req: Request, res: Response) {
    try {
      const { title, description, userType, isAnonymous, userName } = req.body;
      if (!title || !description || !userType || !userName || !isAnonymous) {
        return failureResponse(res, 400, "All fields are required");
      }
      const file = req.file;
      const userID = req.user?.id;

      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      let storyUrl = null;
      if (file) {
        try {
          const uploadResult = await uploadFile(file, {
            folder: "user-stories",
          });
          storyUrl = uploadResult.secure_url;
        } catch (error) {
          console.error("Story upload failed:", error);
          return failureResponse(res, 500, "Failed to upload story");
        }
      }
      const [userStory] = await db
        .insert(userStoriesTable)
        .values({
          userId: userID,
          userName: userName || "Anonymous",
          title,
          description,
          userType,
          isAnonymous,
          attachment: storyUrl,
        })
        .returning();

      return successResponse(
        res,
        201,
        "User story created successfully",
        userStory
      );
    } catch (error) {
      console.error("Error creating user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async approveUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      //Check if the user story is already approved
      const [userStoryApproved] = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .limit(1);
      if (userStoryApproved?.status === "approved") {
        return failureResponse(res, 400, "User story is already approved");
      }
      const [userStory] = await db
        .update(userStoriesTable)
        .set({
          status: "approved",
        })
        .where(eq(userStoriesTable.id, id))
        .returning();
      return successResponse(
        res,
        200,
        "User story approved successfully",
        userStory
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async rejectUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      //Check if the user story is already rejected
      const [userStoryRejected] = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .limit(1);
      if (userStoryRejected?.status === "rejected") {
        return failureResponse(res, 400, "User story is already rejected");
      }
      const [userStory] = await db
        .update(userStoriesTable)
        .set({
          status: "rejected",
        })
        .where(eq(userStoriesTable.id, id))
        .returning();
      return successResponse(
        res,
        200,
        "User story rejected successfully",
        userStory
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async deleteUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const [userStory] = await db
        .delete(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .returning();
      return successResponse(
        res,
        200,
        "User story deleted successfully",
        userStory
      );
    } catch (error) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new UserStoriesController();
