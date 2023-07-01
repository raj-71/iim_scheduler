const axios = require("axios");
const fs = require("fs");
const jsonData = require("./data.json");
const { JSDOM } = require("jsdom");
const TelegramBot = require("node-telegram-bot-api");
const Calendar = require("telegram-inline-calendar");
const cron = require("node-cron");
require("dotenv").config();

const jsonFile = "./data.json";

const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2f0bJ4xN1z9QROs1QrC1UxMeEQ09uaw3WSzRWvbxlpLWUXI1Jh8aC42CMUjAcNrgtlFxBBMeIuB4G/pubhtml?gid=1865835579&single=true&urp=gmail_link&gxid=-8203366";
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
const calendar = new Calendar(bot, {
    date_format: 'MM-DD-YY',
    langugage: 'en'
});



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

        if(res.data){
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
            rowData[`field${index+1}`] = cell.textContent;
        });

        if(Object.keys(rowData).length !== 0)
            data.push(rowData);
    });

    const newJSON = [];

    data.forEach((item) => {
        if(item.field3.length){
            if(isNaN(item.field3.charAt(0)))
                time = item.field3;
            else
                time = timeFormating(item.field3);
        }
        if(item.field1.length){
            let temp = {
                date: item.field1,
                day: item.field2,
                schedule: [],
            };
            newJSON.push(temp);

            let courseTemp = extractCourseInfo(item.field4);

            if(courseTemp){
                courseTemp.time = time;
            }

            newJSON[newJSON.length - 1].schedule.push(courseTemp);
        } else {
            let temp = extractCourseInfo(item.field4);

            if(temp){
                temp.time = time;
            }
            newJSON[newJSON.length - 1].schedule.push(Object(temp));
        }
    });

    let jsonData = JSON.stringify(newJSON, null, 2);

    fs.writeFile(jsonFile, jsonData, (err) => {
        if(err){
            console.log("Error in writing JSON file: ", err);
        } else {
            console.log("JSON file written successfully");
        }
    });
}


const extractedCourses = (schedule) => schedule.filter(scheduleItem => {
    return courses.some(course => course.course === scheduleItem.courseName && course.section === scheduleItem.section);
});


///////////////////////////////////////////////////////////////////
// UPDATE DATE AND TIME HERE
///////////////////////////////////////////////////////////////////


function updateData(){
    console.log('Updating data...')
    sheetRequest();
}


cron.schedule('0 * * * *', updateData);


/////////////////////////////////////////////
//              BOT COMMANDS               //
/////////////////////////////////////////////

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            keyboard: [['Today', 'Tomorrow', 'Choose Date']],
            one_time_keyboard: true,
        }
    };
    bot.sendMessage(chatId, 'Choose an option:', options);
});


bot.onText(/Today|Tomorrow|Choose Date/, async (msg, match) => {
    const chatId = msg.chat.id;
    const option = match[0];

    // Send the data based on the selected option
    if (option === 'Today') {
        bot.sendMessage(chatId, await todaySchedule(), {parse_mode: 'HTML'});
    } else if (option === 'Tomorrow') {
        bot.sendMessage(chatId, await tomorrowSchedule(), {parse_mode: 'HTML'});
    } else if (option === 'Choose Date') {
        
        calendar.startNavCalendar(msg);
    }
});

bot.on("callback_query", async (query) => {
    if(query.message.message_id == calendar.chats.get(query.message.chat.id)) {
        res = calendar.clickButtonCalendar(query);
        if(res !== -1){
            console.log("Selected Date: ", res);
            let date = new Date(res);
            let sch = await schedule(date);
            if(sch.length == 0)
                bot.sendMessage(query.message.chat.id, "Yayyyyy! No class on " + date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'}).replace(/ /g, '/') + ' 🥳🥳🥳');
            else
                bot.sendMessage(query.message.chat.id, "Schedule on " + date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'}).replace(/ /g, '/') + '\n' + sch, {parse_mode: 'HTML'});
        }
    }
})


/////////////////////////////////////////////
//              EXTRACT SCHEDULE           //
/////////////////////////////////////////////



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