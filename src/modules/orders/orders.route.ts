import { Router } from "express";
import ordersController from "./orders.controller.js";
import multer from "multer";
import authenticateJwt from "../../common/middlewares/auth.middleware.js";
const ordersRouter = Router();

ordersRouter.post("/", authenticateJwt, ordersController.createOrder);
ordersRouter.get("/", authenticateJwt, ordersController.getUserOrders);

export default ordersRouter;
