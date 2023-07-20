const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const jsonData = require('./data.json');

const jsonFile = './data.json';
const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2f0bJ4xN1z9QROs1QrC1UxMeEQ09uaw3WSzRWvbxlpLWUXI1Jh8aC42CMUjAcNrgtlFxBBMeIuB4G/pubhtml?gid=1865835579&single=true&urp=gmail_link&gxid=-8203366";




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

function updateData() {
    console.log('Updating data...')
    sheetRequest();
}



updateData();