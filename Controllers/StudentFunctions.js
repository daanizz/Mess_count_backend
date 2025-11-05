import supabase from "../Configurations/dbConnection.js";
import CryptoJS from "crypto-js";
import { verify } from "../middleware/verify.js";

export const getQr = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { hostel_id } = req.body;

    console.log(hostel_id);

    if (!hostel_id) {
      return res.status(400).json({
        success: false,
        message: "Hostel ID is required",
      });
    }

    if (isNaN(parseInt(hostel_id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid hostel ID format",
      });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("user_id, hostel_id")
      .eq("user_id", user_id)
      .eq("hostel_id", hostel_id)
      .maybeSingle();

    if (studentError) {
      console.error("Supabase error (students):", studentError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "User not found or doesn't belong to this hostel",
      });
    }
    // const expiry_date = student.expiry_date;
    // const currentDate = new Date.now();
    // if (expiry_date <= currentDate) {
    //      return res.status(400).json({
    //           success: false,
    //           message: "The user account has been expired, pls constact office if its a mistake",
    //      });
    // }

    const { data: hostel, error: hostelError } = await supabase
      .from("hostels")
      .select("hostel_id")
      .eq("hostel_id", hostel_id)
      .maybeSingle();

    if (hostelError) {
      console.error("Supabase error (hostels):", hostelError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }

    // const expiryTime = Date.now() + 30 * 60 * 1000;
    const code = `${hostel_id}:${user_id}`; //:${expiryTime}
    const encoded = CryptoJS.AES.encrypt(
      code,
      process.env.ENCRYPT_KEY
    ).toString();

    if (!encoded) {
      return res.status(500).json({
        success: false,
        message: "Error generating QR code",
      });
    }

    return res.status(200).json({
      success: true,
      qrCode: encoded,
      // expiresAt: new Date(expiryTime).toISOString(),
    });
  } catch (error) {
    console.error("QR code generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating QR code",
    });
  }
};

//recieves pollData(contains: {title,options:[text]}),student rep id(user_id),hostel_id,end_time from frontend
//checks whether student rep is valid or not
//creates a poll,and stores the poll id
//adds poll_id to every options and add those options to database
//done
export const createPoll = async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const { data: studentRep, error: studentRepfetchingError } = await supabase
      .from("hostel_reps")
      .select("student_id")
      .eq("student_id", user_id)
      .single();

    if (studentRepfetchingError) {
      return res.status(400).json({
        message:
          "Error occured while fetching from database:" +
          studentRepfetchingError.message,
        success: false,
      });
    }
    const { pollData, end_time } = req.body;

    const { data: hostel, error: getHostelError } = await supabase
      .from("students")
      .select("hostel_id")
      .eq("user_id", user_id)
      .single();
    if (getHostelError) {
      return res.status(400).json({
        message: "error in fetching correct hostel: " + getHostelError.message,
      });
    }

    const { data: createdPoll, error: creatingPollError } = await supabase
      .from("polls")
      .insert({
        created_by: user_id,
        title: pollData.title,
        hostel_id: hostel.hostel_id,
        end_time,
      })
      .select("id")
      .single();

    if (creatingPollError) {
      return res.status(404).json({
        message: "Couldnt create poll,error:" + creatingPollError.message,
        success: false,
      });
    }
    const options = pollData.options;
    options.map((option) => {
      option.poll_id = createdPoll.id;
    });

    const { error: optionAddingError } = await supabase
      .from("poll_options")
      .insert(options);

    if (optionAddingError) {
      await supabase
        .from("poll_options")
        .delete()
        .in("poll_id", createdPoll.id);
      await supabase.from("polls").delete().in("id", createdPoll.id);
      return res.status(500).json({
        message:
          "Couldn't create Poll. pls retry!: " + optionAddingError.message,
      });
    }

    return res.status(200).json({
      message: "Created the poll successfully..",
      success: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal error: " + error.message });
  }
};

export const makeVote = async (req, res) => {
  const { user_id } = req.user.user_id;
  const { optionId } = req.body;

  try {
    if (!optionId) {
      return res.status(400).json({
        message: "No option selected or id not found",
        success: false,
      });
    }
    const { data: polled, error: checkingDbError } = await supabase
      .from("votes")
      .select("id")
      .eq("student_id", user_id)
      .eq("option_id");
    const { error: addingVoteError } = await supabase
      .from("votes")
      .insert({ student_id: user_id, option_id: optionId });
    if (addingVoteError) {
      return res.status(500).json({
        message: "error in making vote" + addingVoteError,
      });
    }
    return res.status(200).json({ message: "Marked the vote", success: true });
  } catch (error) {
    return res.status(500).json({ message: error });
  }
};

export const viewCurrentPolls = async (req, res) => {
  const { hostel_id } = req.body;
  const currentTime = new Date().toISOString();
  // console.log(currentTime);
  const { data: pollData, error: pollRetreivingError } = await supabase
    .from("polls")
    .select("*")
    .eq("hostel_id", hostel_id)
    .lt("end_time", currentTime);
  if (pollRetreivingError) {
    return res.status(400).json({
      message: "Error in getting polls: " + pollRetreivingError.message,
    });
  }

  const makePoll = await Promise.all(
    pollData.map(async (poll) => {
      const { data: optionData } = await supabase
        .from("poll_options")
        .select("id,text")
        .eq("poll_id", poll.id);

      const getVotes = await Promise.all(
        optionData.map(async (option) => {
          const { count } = await supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("option_id", option.id);
          option.votes = count;
        })
      );

      poll.options = optionData;
    })
  );

  return res.status(200).json({ pollData, success: true });
};

export const MyMeals = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("meal_logs")
      .select(
        `
        time_stamp,
        meals ( meal_type )
      `
      )
      .eq("student_id", user_id)
      .gte("time_stamp", startOfDay.toISOString())
      .lte("time_stamp", endOfDay.toISOString())
      .order("time_stamp", { ascending: false });

    if (error) throw error;

    const formattedMeals = data.map((log) => ({
      meal_type: log.meals?.meal_type || "Unknown",
      time: log.time_stamp,
    }));

    res.status(200).json({
      success: true,
      message: "Today's meals fetched successfully",
      meals: formattedMeals,
    });
  } catch (error) {
    console.error("Error fetching today's meals:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
