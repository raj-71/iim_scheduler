const axios = require("axios");
const fs = require("fs");
const jsonData = require("./data.json");
const { JSDOM } = require("jsdom");
const TelegramBot = require("node-telegram-bot-api");
const Calendar = require("telegram-inline-calendar");
const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("./models/user");
const { google } = require("calendar-link");
require("dotenv").config();

const jsonFile = "./data.json";


// connect to mongodb
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log("Error in connecting to MongoDB: ", err);
});




const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2f0bJ4xN1z9QROs1QrC1UxMeEQ09uaw3WSzRWvbxlpLWUXI1Jh8aC42CMUjAcNrgtlFxBBMeIuB4G/pubhtml?gid=1865835579&single=true&urp=gmail_link&gxid=-8203366";
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
const calendar = new Calendar(bot, {
    date_format: 'MM-DD-YY',
    langugage: 'en'
});

function getUniqueCourseNames(data) {
    const courseMap = new Map();

    data.forEach((item) => {
        item.schedule.forEach((scheduleItem) => {
            const { courseName, section } = scheduleItem;

            if (!courseMap.has(courseName)) {
                courseMap.set(courseName, new Set());
            }

            if (section) {
                courseMap.get(courseName).add(section);
            }
        });
    });

    const uniqueCourseNames = [];

    courseMap.forEach((sections, courseName) => {
        const course = {
            courseName,
            sections: Array.from(sections)
        };

        uniqueCourseNames.push(course);
    });

    return uniqueCourseNames;
}






///////////////////////////  FUNCTIONS  ///////////////////////////

const courses = [
    {
        course: "STIC",
        section: "B"
    },
    {
        course: "PPA",
        section: "A"
    },
    {
        course: "BIDM",
        section: ""
    },
    {
        course: "GLSCM",
        section: ""
    },
    {
        course: "QMSS",
        section: ""
    },
    {
        course: "PM",
        section: "B"
    },
    {
        course: "DAR",
        section: ""
    }
];


const extractCourseInfo = (text) => {
    let classroom = "";
    let courseName = "";
    let faculty = "";
    let lectureNo = "";
    let section = "";

    let textArr = text.split(" ");

    // classroom
    if (textArr[textArr.length - 1].slice(0, 2) === "CR" || textArr[textArr.length - 1].slice(0, 2) === "CC") {
        classroom = textArr[textArr.length - 1];
    }

    // course
    courseName = textArr[0];

    let i = 0;

    // section and lecture no
    if (isNaN(textArr[1])) {
        section = textArr[1];
        lectureNo = textArr[2];
        i = 3;
    }
    else {
        lectureNo = textArr[1];
        i = 2;
    }

    // faculty
    for (; i < textArr.length; i++) {
        if (textArr[i].slice(0, 2) === "CR" || textArr[i].slice(0, 2) === "CC")
            break;
        faculty += textArr[i] + " ";
    }

    let courseDetails = {
        courseName,
        section,
        lectureNo,
        faculty,
        classroom,
    }

    return courseDetails;
}


const timeFormating = (time) => {
    const convertTo12 = (time24) => {
        let [hours, minutes] = time24.split(":");

        let hoursNum = parseInt(hours, 10);

        const period = hoursNum >= 12 ? "PM" : "AM";

        hoursNum = hoursNum % 12 || 12;

        const time12 = `${hoursNum}:${minutes} ${period}`;
        return time12;
    }

    let timeFormating = time.split("-");
    let fromTime = timeFormating[0].split(" ")[0];

    let toTime = timeFormating[1].split(" ")[1];

    fromTime = convertTo12(fromTime);
    toTime = convertTo12(toTime);

    return fromTime + " - " + toTime;
}


const sheetRequest = async () => {
    try {
        const res = await axios.get(url);

        if (res.data) {
            htmlToJSON(res.data);
        }

    } catch (error) {
        console.log("Error in getting sheet data: ", error);
    }
};


const htmlToJSON = (htmlData) => {
    const dom = new JSDOM(htmlData);

    const table = dom.window.document.querySelector('table');

    const rows = table.querySelectorAll("tr");
    const data = [];

    rows.forEach((row) => {
        const rowData = {};
        const cells = row.querySelectorAll("td");

        cells.forEach((cell, index) => {
            rowData[`field${index + 1}`] = cell.textContent;
        });

        if (Object.keys(rowData).length !== 0)
            data.push(rowData);
    });

    const newJSON = [];

    data.forEach((item) => {
        if (item.field3.length) {
            if (isNaN(item.field3.charAt(0)))
                time = item.field3;
            else
                time = timeFormating(item.field3);
        }
        if (item.field1.length) {
            let temp = {
                date: item.field1,
                day: item.field2,
                schedule: [],
            };
            newJSON.push(temp);

            let courseTemp = extractCourseInfo(item.field4);

            if (courseTemp) {
                courseTemp.time = time;
            }

            newJSON[newJSON.length - 1].schedule.push(courseTemp);
        } else {
            let temp = extractCourseInfo(item.field4);

            if (temp) {
                temp.time = time;
            }
            newJSON[newJSON.length - 1].schedule.push(Object(temp));
        }
    });

    let jsonData = JSON.stringify(newJSON, null, 2);

    fs.writeFile(jsonFile, jsonData, (err) => {
        if (err) {
            console.log("Error in writing JSON file: ", err);
        } else {
            console.log("JSON file written successfully");
        }
    });
}


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


///////////////////////////////////////////////////////////////////
// UPDATE DATE AND TIME HERE
///////////////////////////////////////////////////////////////////


function updateData() {
    console.log('Updating data...')
    sheetRequest();
}


cron.schedule('0 * * * *', updateData);


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
            username: msg.from.username,
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

bot.onText(/\/add_course/, async (msg) => {

    const chatId = msg.chat.id;

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
    const coursesList = require('./coursesLists.json');

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