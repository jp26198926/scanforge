import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanforgeRouter from "./scanforge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanforgeRouter);

export default router;
