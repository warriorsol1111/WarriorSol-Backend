import { Router } from "express";
import ordersController from "./orders.controller.js";
import multer from "multer";

const ordersRouter = Router();

ordersRouter.post("/", ordersController.createOrder);
ordersRouter.get("/", ordersController.getUserOrders);
