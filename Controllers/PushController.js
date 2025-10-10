import webPush from "web-push";
import supabase from "../Configurations/dbConnection.js";
import dotenv from "dotenv";

dotenv.config();

webPush.setVapidDetails(
  "mailto:jirayajiraya500@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const SaveSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    const user_id = req.user.user_id;

    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "Subscription required" });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert([{ user_id, subscription }], { onConflict: "user_id" });

    if (error) {
      console.error("Supabase error (push_subscriptions):", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save subscription" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Subscription saved" });
  } catch (error) {
    console.error("Save subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const SendNotification = async (user_id, title, body) => {
  try {
    const { data: sub, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error || !sub) {
      console.error("No subscription found for user:", user_id);
      return;
    }

    const payload = JSON.stringify({ title, body });

    await webPush.sendNotification(sub.subscription, payload);
  } catch (error) {
    console.error("Send notification error:", error);
  }
};
