import Thumbnail from "../models/Thumbnail.js";
import { Request, Response } from "express";

// Get all thumbnails of logged-in user
export const getusersThumbnails = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const thumbnails = await Thumbnail
      .find({ userId })
      .sort({ createdAt: -1 });

    res.json({ thumbnails });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get single thumbnail
export const getThumbnailbyId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const thumbnail = await Thumbnail.findOne({ _id: id, userId });

    if (!thumbnail) {
      return res.status(404).json({ message: "Thumbnail not found" });
    }

    res.json({ thumbnail });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
