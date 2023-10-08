const TelegramBot = require("node-telegram-bot-api");
const Calendar = require("telegram-inline-calendar");
const mongoose = require("mongoose");
const User = require("./models/user");
const { google } = require("calendar-link");
require("dotenv").config();

const jsonData = require("./data.json");
const coursesList = require('./coursesLists.json');

// connect to mongodb
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log("Error in connecting to MongoDB: ", err);
});


const token = process.env.TOKEN_PROD;
const bot = new TelegramBot(token, { polling: true });
const calendar = new Calendar(bot, {
    date_format: 'MM-DD-YY',
    langugage: 'en'
});

// function getUniqueCourseNames(data) {
//     const courseMap = new Map();

//     data.forEach((item) => {
//         item.schedule.forEach((scheduleItem) => {
//             const { courseName, section } = scheduleItem;

//             if (!courseMap.has(courseName)) {
//                 courseMap.set(courseName, new Set());
//             }

//             if (section) {
//                 courseMap.get(courseName).add(section);
//             }
//         });
//     });

//     const uniqueCourseNames = [];

//     courseMap.forEach((sections, courseName) => {
//         const course = {
//             courseName,
//             sections: Array.from(sections)
//         };

//         uniqueCourseNames.push(course);
//     });

//     return uniqueCourseNames;
// }

// console.log(getUniqueCourseNames(jsonData));




///////////////////////////  FUNCTIONS  ///////////////////////////

// const courses = [
//     {
//         course: "STIC",
//         section: "B"
//     },
//     {
//         course: "PPA",
//         section: "A"
//     },
//     {
//         course: "BIDM",
//         section: ""
//     },
//     {
//         course: "GLSCM",
//         section: ""
//     },
//     {
//         course: "QMSS",
//         section: ""
//     },
//     {
//         course: "PM",
//         section: "B"
//     },
//     {
//         course: "DAR",
//         section: ""
//     }
// ];


const extractedCourses = (schedule, userCourses) => {
    return schedule.filter((scheduleItem) => {
        return userCourses.some((userCourse) => {
            return (
                userCourse.courseName === scheduleItem.courseName &&
                userCourse.section === scheduleItem.section
            )
        });
    });
}



/////////////////////////////////////////////
//              BOT COMMANDS               //
/////////////////////////////////////////////

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const existingUser = await User.findOne({ userId: userId });
    if (!existingUser) {
        const newUser = new User({
            userId,
            first_name: msg.from.first_name || "",
            last_name: msg.from.last_name || "",
            username: msg.from.username || "",
        });

        try {
            await newUser.save();
            bot.sendMessage(chatId, 'Welcome to Scheduler Bot 😀, Choose Options from Menu');
        } catch (error) {
            bot.sendMessage(chatId, 'Error in registering you, please try again with /start command\nReport this issue to @lost8bytes');
        }
    } else {
        bot.sendMessage(chatId, 'Welcome to Scheduler Bot 😀, Choose Options from Menu');
    }

});

bot.onText(/\/today/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        let sch = await todaySchedule(userId);
        if (sch.length == 0)
            bot.sendMessage(chatId, "Yayyyyy! No class today " + ' 🥳🥳🥳');
        else
            bot.sendMessage(chatId, "Today's Schedule \n" + '\n' + sch, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (error) {
        bot.sendMessage(chatId, "Error in fetching data. Try again later.\nReport at @lost8bytes", { parse_mode: 'HTML' });
    }
});

bot.onText(/\/tomorrow/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        let sch = await tomorrowSchedule(userId);
        if (sch.length == 0)
            bot.sendMessage(chatId, "Yayyyyy! No class tomorrow " + ' 🥳🥳🥳');
        else
            bot.sendMessage(chatId, "Tomorrow's Schedule \n\n" + sch, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (error) {
        bot.sendMessage(chatId, "Error in fetching data. Try again later.\nReport to @lost8bytes", { parse_mode: 'HTML' });
    }
});

bot.onText(/\/choose_date/, async (msg) => {
    try {
        calendar.startNavCalendar(msg);
    } catch (error) {
        bot.sendMessage(msg.chat.id, "Error in fetching data. Try again later.\nReport to @lost8bytes", { parse_mode: 'HTML' });
    }
});

bot.on("callback_query", async (query) => {
    if (query.message.message_id == calendar.chats.get(query.message.chat.id)) {
        res = calendar.clickButtonCalendar(query);
        if (res !== -1) {
            let date = new Date(res);
            let sch = await schedule(query.from.id, date);
            if (sch.length == 0)
                bot.sendMessage(query.message.chat.id, "Yayyyyy! No class on " + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/ /g, '/') + ' 🥳🥳🥳');
            else
                bot.sendMessage(query.message.chat.id, "Schedule on " + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/ /g, '/') + '\n\n' + sch, { parse_mode: 'HTML', disable_web_page_preview: true });
        }
    }
});

// bot.on("callback_query", async (query) => {
//     const data = query.data;
//     let userCourseSelections = {};

//     // Handle calendar callbacks
//     if (query.message.message_id == calendar.chats.get(query.message.chat.id)) {
//         res = calendar.clickButtonCalendar(query);
//         if (res !== -1) {
//             let date = new Date(res);
//             let sch = await schedule(query.from.id, date);
//             if (sch.length == 0)
//                 bot.sendMessage(query.message.chat.id, "Yayyyyy! No class on " + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/ /g, '/') + ' 🥳🥳🥳');
//             else
//                 bot.sendMessage(query.message.chat.id, "Schedule on " + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/ /g, '/') + '\n\n' + sch, { parse_mode: 'HTML', disable_web_page_preview: true });
//         }
//     } 
//     // Handle course selection
//     else if (data.startsWith("courseSelect_course_")) {
//         const selectedCourseName = data.split("_")[2];

//         if (!userCourseSelections[query.from.id]) {
//             userCourseSelections[query.from.id] = [];
//         }

//         if (userCourseSelections[query.from.id].includes(selectedCourseName)) {
//             // User deselected a course
//             userCourseSelections[query.from.id] = userCourseSelections[query.from.id].filter(courseName => courseName !== selectedCourseName);
//         } else {
//             userCourseSelections[query.from.id].push(selectedCourseName);
//         }

//         bot.answerCallbackQuery(query.id);
//     } 
//     // Handle section selection
//     else if (data.startsWith("courseSelect_section_")) {
//         const [, , courseName, section] = data.split("_");
//         bot.sendMessage(query.message.chat.id, `You selected ${courseName} section ${section}.`);
//         delete userCourseSelections[query.from.id];
//     } 
//     // Handle course submission
//     else if (data === "courseSelect_submit_courses") {
//         if (userCourseSelections[query.from.id] && userCourseSelections[query.from.id].length > 0) {
//             // Find courses with non-empty sections
//             const coursesWithSections = courses.filter(course => 
//                 userCourseSelections[query.from.id].includes(course.courseName) && course.sections.length > 0
//             );

//             // If there are courses with sections
//             if (coursesWithSections.length > 0) {
//                 const sectionsKeyboard = coursesWithSections.map(course => course.sections.map(section => ({
//                     text: `${course.courseName} - ${section}`,
//                     callback_data: `courseSelect_section_${course.courseName}_${section}`
//                 })));

//                 bot.sendMessage(query.message.chat.id, "Please select one section:", {
//                     reply_markup: {
//                         inline_keyboard: sectionsKeyboard
//                     }
//                 });
//             } else {
//                 bot.sendMessage(query.message.chat.id, `You selected: ${userCourseSelections[query.from.id].join(', ')}`);
//                 delete userCourseSelections[query.from.id];
//             }
//         } else {
//             bot.sendMessage(query.message.chat.id, `You haven't selected any courses.`);
//         }
//     }
// });




bot.onText(/\/add_course/, async (msg) => {

    const chatId = msg.chat.id;
    
    // const keyboard = coursesList.map(course => [{
    //     text: course.courseName,
    //     callback_data: `courseSelect_course_${course.courseName}`
    // }]);

    // // Add a submit button
    // keyboard.push([{ text: "Submit", callback_data: "courseSelect_submit_courses" }]);

    // bot.sendMessage(chatId, "Please select your courses and then hit submit:", {
    //     reply_markup: {
    //         inline_keyboard: keyboard
    //     }
    // });

    const courseNames = coursesList.map(course => course.courseName).sort();

// Format the course names into a list message
    const message = "<b>All Courses List:</b>\n" + courseNames.map(name => `${name}`).join('\n');

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    bot.sendMessage(chatId, "Enter course name: ", { parse_mode: 'HTML' })
        .then(async () => {
            bot.once('message', async (message) => {
                const courseName = message.text.toUpperCase();

                const courseRes = findCourse(courseName);

                if (!courseRes.course) {
                    bot.sendMessage(chatId, "🔴 Course not found. Try again by using 'Add Course' option.", { parse_mode: 'HTML' });
                    return;
                }

                // check if course is already present in database
                const coursePresent = await User.findOne({ userId: msg.from.id, "courses.courseName": courseName });

                if (coursePresent) {
                    bot.sendMessage(chatId, "🟡 Course already added, try adding different course.", { parse_mode: 'HTML' });
                    return;
                }


                if (courseRes.course && courseRes.sectionPresent) {
                    bot.sendMessage(chatId, "Enter section: ", { parse_mode: 'HTML' })
                        .then(async () => {

                            bot.once('message', async (sectionMsg) => {
                                const section = sectionMsg.text.toUpperCase();

                                const sectionRes = findCourse(courseName, section);

                                if (!sectionRes.sectionPresent) {
                                    bot.sendMessage(chatId, "🔴 Section not found. Try again by using 'Add Course' option.", { parse_mode: 'HTML' });
                                    return;
                                }

                                if (sectionRes.course && sectionRes.sectionPresent) {

                                    await User.findOneAndUpdate(
                                        { userId: chatId },
                                        { $push: { courses: { courseName: courseName, section } } },
                                        { new: true },
                                    )

                                    bot.sendMessage(chatId, "🟢 Course Added Successfully! 👍", { parse_mode: 'HTML' });
                                    return;
                                }
                            });
                        })
                }

                if (courseRes.course && !courseRes.sectionPresent) {
                    await User.findOneAndUpdate(
                        { userId: chatId },
                        { $push: { courses: { courseName: courseName, section: "" } } },
                        { new: true },
                    );
                    bot.sendMessage(chatId, "🟢 Course Added Successfully! 👍", { parse_mode: 'HTML' })
                }

            });
        })
        .catch((err) => {
            console.log("Error in sending message: ", err);
        });

});

bot.onText(/\/my_courses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const userCourses = await User.findOne({ userId: userId }).select('courses');
        if (userCourses.courses.length == 0) {
            bot.sendMessage(chatId, "No courses added yet. Add courses using '/add_course' option.", { parse_mode: 'HTML' });
            return;
        } else {
            let courses = "";
            for (let i = 0; i < userCourses.courses.length; i++) {
                courses += i + 1 + ". <b>" + userCourses.courses[i].courseName + " " + userCourses.courses[i].section + "</b>\n";
            }
            bot.sendMessage(chatId, "Your courses are: \n\n" + courses, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.log("Error in fetching courses: ", error);
        bot.sendMessage(chatId, "Error in fetching courses. Try again later.\nReport to @lost8bytes", { parse_mode: 'HTML' });
    }
});

bot.onText(/\/remove_course/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const user = await User.findOne({ userId: chatId });
        if (!user || user.courses.length === 0) {
            bot.sendMessage(chatId, "You have not added any courses yet.");
            return;
        }

        const keyboard = {
            keyboard: user.courses.map((course, index) => [{ text: `${index + 1}. ${course.courseName}` }]),
            one_time_keyboard: true,
        };

        bot.sendMessage(chatId, "Select the course you want to remove:", {
            reply_markup: keyboard,
        });
    } catch (error) {
        console.log("Error retrieving user's courses:", error);
        bot.sendMessage(chatId, "An error occurred while retrieving your courses. Please try again later.");
    }
});

bot.onText(/(\d+)\. .+/, async (msg, match) => {
    const chatId = msg.chat.id;
    const selectedCourseIndex = parseInt(match[1], 10);

    try {
        const user = await User.findOne({ userId: chatId });
        if (!user || user.courses.length === 0) {
            bot.sendMessage(chatId, "You have not added any courses yet.");
            return;
        }

        const selectedCourse = user.courses[selectedCourseIndex - 1];
        if (!selectedCourse) {
            bot.sendMessage(chatId, "Invalid course selection. Please try again.");
            return;
        }

        await User.findOneAndUpdate(
            { userId: chatId },
            { $pull: { courses: selectedCourse } },
            { new: true }
        );

        bot.sendMessage(chatId, "Course removed successfully!");
    } catch (error) {
        console.log("Error removing course:", error);
        bot.sendMessage(chatId, "An error occurred while removing the course. Please try again later.");
    }
});

bot.onText(/\/report/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    bot.sendMessage(chatId, "Report your issue to @lost8bytes", { parse_mode: 'HTML' });
});



/////////////////////////////////////////////
//              EXTRACT SCHEDULE           //
/////////////////////////////////////////////



const todaySchedule = async (userId) => {
    let today = new Date();
    return schedule(userId, today);
}

const tomorrowSchedule = async (userId) => {
    let today = new Date();
    let tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return schedule(userId, tomorrow);
}

const schedule = async (userId, dateIncoming) => {
    let date = dateIncoming.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '/')
        .replace(/\b(\w{3})\w+\b/g, '$1');

    const userCourses = await User.findOne({ userId: userId }).select('courses');



    let data = [];
    await Promise.all(
        jsonData.map(async (item) => {
            // match course name
            if (item.date === date) {
                data = extractedCourses(item.schedule, userCourses.courses);
            }
        })
    );

    let text = "";

    data.map((item, index) => {

        text += `<b>${index + 1}. ${item.courseName}</b>${item.section ? " - <b>" + item.section + "</b>" : ""} \n
    Lecture No.: <b>${item.lectureNo}</b>
    Time: <b>${item.time}</b>
    Classroom: <b>${item.classroom}</b>
    Faculty: <b>${item.faculty}</b>
    `;
        text += generateCalendarLink(item, date) + "\n\n";
    });

    return text;
}

const findCourse = (courseName, section = "") => {

    if (!section) {
        const course = coursesList.find(course => course.courseName === courseName);
        if (!course) {
            return {
                course: false,
                sectionPresent: false,
            }
        }
        else {
            if (course.sections.length > 0) {
                return {
                    course: true,
                    sectionPresent: true,
                };
            }
            else
                return {
                    course: true,
                    sectionPresent: false,
                }
        }
    } else {
        const course = coursesList.find(course => course.courseName === courseName && course.sections.includes(section));
        if (!course) {
            return {
                course: false,
                sectionPresent: false,
            }
        }
        else {
            if (course.sections.length > 0) {
                return {
                    course: true,
                    sectionPresent: true,
                };
            }
            else
                return {
                    course: true,
                    sectionPresent: false,
                }
        }
    }
}

const generateCalendarLink = (eventDetails, date) => {
    const event = {
        title: eventDetails.courseName,
        description: eventDetails.faculty,
        start: date + " " + eventDetails.time.split("-")[0],
        duration: [1.5, "hour"],
        location: eventDetails.classroom,
    }
    const link = google(event);
    return `<a href="${link}">Add to Calendar</a>\n`;
}



// /////////////////////////////////////////////
// // For deployment http server
// /////////////////////////////////////////////

// const {createServer} = require('http')

// const server = createServer(() => {})

// server.listen(3000)