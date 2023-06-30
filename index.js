const axios = require("axios");
const express = require("express");
const fs = require("fs");
const csv = require("csvtojson");
const jsonData = require("./data.json");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const csvFile = "./data.csv";
const jsonFile = "./data.json";

const app = express();

const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2f0bJ4xN1z9QROs1QrC1UxMeEQ09uaw3WSzRWvbxlpLWUXI1Jh8aC42CMUjAcNrgtlFxBBMeIuB4G/pubhtml?gid=1865835579&single=true&urp=gmail_link&gxid=-8203366";
const port = 5000;
const token = process.env.TOKEN;


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
    await axios.get(url).then((res) => {
        let dataFromSheet = res.data;

        const newJSON = [];

        csv()
            .fromFile(csvFile)
            .then((jsonObj) => {
                let jsonString = JSON.stringify(jsonObj, null, 2);
                let time = "";
                jsonObj.forEach((item, index) => {
                    // console.log(item);
                    if (item.field4.length) {
                        if (isNaN(item.field4.charAt(0)))
                            time = item.field4;
                        else
                            time = timeFormating(item.field4);
                    }
                    if (item.field2.length) {
                        let temp = {
                            date: item.field2,
                            day: item.field3,
                            schedule: [],
                        };
                        newJSON.push(temp);

                        let courseTemp = extractCourseInfo(item.field5);

                        if (courseTemp) {
                            courseTemp.time = time;
                        }

                        newJSON[newJSON.length - 1].schedule.push(courseTemp);
                    } else {
                        let temp = extractCourseInfo(item.field5);

                        if (temp) {
                            temp.time = time;
                        }
                        newJSON[newJSON.length - 1].schedule.push(Object(temp));
                    }
                });

                jsonString = JSON.stringify(newJSON, null, 2);

                fs.writeFile(jsonFile, jsonString, (err) => {
                    if (err) {
                        console.error("Error writing JSON file:", err);
                    } else {
                        console.log("CSV file converted to JSON successfully!");
                    }
                });
            })
            .catch((err) => {
                console.log(err);
            });
    });
};


const extractedCourses = (schedule) => schedule.filter(scheduleItem => {
    return courses.some(course => course.course === scheduleItem.courseName && course.section === scheduleItem.section);
});

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            keyboard: [['Today', 'Tomorrow']],
            one_time_keyboard: true,
        }
    };
    bot.sendMessage(chatId, 'Choose an option:', options);
});

bot.onText(/Today|Tomorrow/, async (msg, match) => {
    const chatId = msg.chat.id;
    const option = match[0];

    // Send the data based on the selected option
    if (option === 'Today') {
        bot.sendMessage(chatId, await todaySchedule(), {parse_mode: 'HTML'});
    } else if (option === 'Tomorrow') {
        bot.sendMessage(chatId, await tomorrowSchedule(), {parse_mode: 'HTML'});
    }
});


const todaySchedule = async () => {
    let today = new Date();
    return schedule(today);
}

const tomorrowSchedule = async () => {
    let today = new Date();
    let tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return schedule(tomorrow);
}

const schedule = async (dateIncoming) => {
    let date = dateIncoming.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '/');

    console.log(date);

    let data = [];
    await Promise.all(
        jsonData.map(async (item) => {
            // match course name
            if (item.date === date) {
                data = extractedCourses(item.schedule);
            }
        })
    );

    let text = "";

    data.map((item, index) => {
        text += `<b>${index+1}. ${item.courseName}</b>${item.section? " - <b>" + item.section + "</b>" : ""} \n
    Time: <b>${item.time}</b>
    Classroom: <b>${item.classroom}</b>
    Faculty: <b>${item.faculty}</b>
    \n`;
    });

    return text;
}


// app.get("/", async (req, res) => {


//     try {
//         await sheetRequest();
//     } catch (err) {
//         console.log("Can't fetch sheet data!!!\n", err);
//     }

//     let today = new Date();
//     let tomorrow = new Date(today);
//     tomorrow.setDate(today.getDate() + 1);

//     let date = tomorrow.toLocaleDateString('en-GB', {
//         day: 'numeric', month: 'short', year: '2-digit'
//     }).replace(/ /g, '/');

//     console.log(date);

//     let data = [];
//     await Promise.all(
//         jsonData.map(async (item) => {
//             // match course name
//             if (item.date === date) {
//                 data = extractedCourses(item.schedule);
//             }
//         })
//     );
//     res.send(data);
// });

// app.listen(port, () => console.log(`Server running on port ${port}`));
