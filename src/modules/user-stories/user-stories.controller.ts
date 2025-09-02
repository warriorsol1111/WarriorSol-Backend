import { Request, Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import db from "../../common/database/index.js";
import { userStoriesTable, usersTable } from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";
import { uploadFile } from "../../common/utils/cloudinary.js";
import { publishToQueue } from "../email/producers/email.producers.js";

declare module "express" {
  interface Request {
    user?: { id: string };
  }
}

class UserStoriesController {
  async getAllUserStories(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const userStories = await db
        .select()
        .from(userStoriesTable)
        .where(
          and(
            eq(userStoriesTable.status, "pending"),
            eq(userStoriesTable.isArchived, false)
          )
        )
        .orderBy(desc(userStoriesTable.createdAt));

      return successResponse(
        res,
        200,
        "User stories fetched successfully",
        userStories
      );
    } catch (error) {
      console.error("Error fetching user stories:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getApprovedUserStories(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const userStories = await db
        .select({
          story: userStoriesTable,
          user: {
            id: usersTable.id,
            name: usersTable.name,
            profilePhoto: usersTable.profilePhoto,
          },
        })
        .from(userStoriesTable)
        .innerJoin(usersTable, eq(userStoriesTable.userId, usersTable.id))
        .where(
          and(
            eq(userStoriesTable.status, "approved"),
            eq(userStoriesTable.isArchived, false)
          )
        )
        .orderBy(desc(userStoriesTable.createdAt));

      return successResponse(
        res,
        200,
        "Approved user stories fetched successfully",
        userStories
      );
    } catch (error) {
      console.error("Error fetching approved stories:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getUserStoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const userStory = await db
        .select({
          story: userStoriesTable,
          user: {
            id: usersTable.id,
            name: usersTable.name,
            profilePhoto: usersTable.profilePhoto,
          },
        })
        .from(userStoriesTable)
        .leftJoin(usersTable, eq(userStoriesTable.userId, usersTable.id))
        .where(
          and(
            eq(userStoriesTable.id, id),
            eq(userStoriesTable.isArchived, false)
          )
        );

      return successResponse(
        res,
        200,
        "User story fetched successfully",
        userStory
      );
    } catch (error) {
      console.error("Error fetching user story by id:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async createUserStory(req: Request, res: Response) {
    try {
      const { title, description, userType, isAnonymous, userName } = req.body;
      const file = req.file;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");
      if (!title || !description || !userType || !userName || !isAnonymous) {
        return failureResponse(res, 400, "All fields are required");
      }

      let attachmentUrl = null;
      if (file) {
        try {
          const uploadResult = await uploadFile(file, {
            folder: "user-stories",
          });
          attachmentUrl = uploadResult.secure_url;
        } catch (err) {
          console.error("Story upload failed:", err);
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
          isArchived: false,
          attachment: attachmentUrl,
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
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const [existing] = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .limit(1);

      if (!existing) return failureResponse(res, 404, "User story not found");
      if (existing.status === "approved")
        return failureResponse(res, 400, "User story is already approved");

      const [updatedStory] = await db
        .update(userStoriesTable)
        .set({ status: "approved" })
        .where(eq(userStoriesTable.id, id))
        .returning();

      // Send approval email
      try {
        const [user] = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, updatedStory.userId));

        if (user?.email) {
          await publishToQueue({
            email: user.email,
            subject: "Your Story Has Been Approved!",
            templatePath: "user-story-approved.ejs",
            templateData: {
              userName: updatedStory.userName,
              title: updatedStory.title,
            },
          });
        }
      } catch (err) {
        console.error("Failed to send story approval email:", err);
      }

      return successResponse(
        res,
        200,
        "User story approved successfully",
        updatedStory
      );
    } catch (error) {
      console.error("Error approving user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async rejectUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const [existing] = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .limit(1);

      if (!existing) return failureResponse(res, 404, "User story not found");
      if (existing.status === "rejected")
        return failureResponse(res, 400, "User story is already rejected");

      const [updatedStory] = await db
        .update(userStoriesTable)
        .set({ status: "rejected" })
        .where(eq(userStoriesTable.id, id))
        .returning();

      // Send rejection email
      try {
        const [user] = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, updatedStory.userId));

        if (user?.email) {
          await publishToQueue({
            email: user.email,
            subject: "Your Story Submission Update",
            templatePath: "user-story-rejected.ejs",
            templateData: {
              userName: updatedStory.userName,
              title: updatedStory.title,
            },
          });
        }
      } catch (err) {
        console.error("Failed to send story rejection email:", err);
      }

      return successResponse(
        res,
        200,
        "User story rejected successfully",
        updatedStory
      );
    } catch (error) {
      console.error("Error rejecting user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async deleteUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const [deletedStory] = await db
        .delete(userStoriesTable)
        .where(eq(userStoriesTable.id, id))
        .returning();

      return successResponse(
        res,
        200,
        "User story deleted successfully",
        deletedStory
      );
    } catch (error) {
      console.error("Error deleting user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
  async archiveUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const [updatedStory] = await db
        .update(userStoriesTable)
        .set({ isArchived: true })
        .where(eq(userStoriesTable.id, id))
        .returning();

      if (!updatedStory)
        return failureResponse(res, 404, "User story not found");

      return successResponse(
        res,
        200,
        "User story archived successfully",
        updatedStory
      );
    } catch (error) {
      console.error("Error archiving user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async unarchiveUserStory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const [updatedStory] = await db
        .update(userStoriesTable)
        .set({ isArchived: false })
        .where(eq(userStoriesTable.id, id))
        .returning();

      if (!updatedStory)
        return failureResponse(res, 404, "User story not found");

      return successResponse(
        res,
        200,
        "User story unarchived successfully",
        updatedStory
      );
    } catch (error) {
      console.error("Error unarchiving user story:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async fetchArchivedUserStories(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");
      const userStories = await db
        .select()
        .from(userStoriesTable)
        .where(eq(userStoriesTable.isArchived, true))
        .orderBy(desc(userStoriesTable.createdAt));
      return successResponse(
        res,
        200,
        "Archived user stories fetched successfully",
        userStories
      );
    } catch (error) {
      console.error("Error fetching archived stories:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new UserStoriesController();
