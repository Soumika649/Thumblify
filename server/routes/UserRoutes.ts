import express  from "express";
import { getThumbnailbyId, getusersThumbnails } from "../controllers/UserController.js";
import protect from "../middlewares/auth.js";

const UserRouter = express.Router();

UserRouter.get('/thumbnails',protect, getusersThumbnails)
UserRouter.get('/thumbnail/:id',protect, getThumbnailbyId)

export default UserRouter;