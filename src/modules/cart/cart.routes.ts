import { Router } from "express";
import cartController from "./cart.controller.ts";
import authenticateJwt from "../../common/middlewares/auth.middleware.ts";

const cartRouter = Router();
cartRouter.get("/", authenticateJwt, cartController.getCartID);
cartRouter.post("/", authenticateJwt, cartController.saveCartID);
cartRouter.delete("/", authenticateJwt, cartController.deleteCartID);

export default cartRouter;
