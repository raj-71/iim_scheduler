const cheerio = require("cheerio");
const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2f0bJ4xN1z9QROs1QrC1UxMeEQ09uaw3WSzRWvbxlpLWUXI1Jh8aC42CMUjAcNrgtlFxBBMeIuB4G/pubhtml?gid=1865835579&single=true&urp=gmail_link&gxid=-8203366";

const htmltocsv = async () => {
    await axios.get(url).then((res) => {
        const $ = cheerio.load(res.data);
        
        // Select the table rows
        const rows = $('table tr');
    
        // Extract the headers from the first row
        const headers = [];
        $(rows[0])
        .find('th')
        .each(function () {
            headers.push($(this).text().trim());
        });
    
        // Extract the data from the remaining rows
        const data = [];
        for (let i = 1; i < rows.length; i++) {
        const row = [];
        $(rows[i])
            .find('td')
            .each(function () {
            row.push($(this).text().trim());
            });
        data.push(row);
        }
    
        // Create the CSV writer
        const csvWriter = createCsvWriter({
            path: 'output.csv',
            header: headers.map((header) => ({ id: header, title: header })),
        });
        
        // Write the data to the CSV file
        csvWriter
            .writeRecords(data)
            .then(() => {
            console.log('CSV file has been written successfully.');
            })
            .catch((err) => {
            console.error('Error writing CSV file:', err);
            });
    });


}

htmltocsv();


        // csv()
        //     .fromFile(csvFile)
        //     .then((jsonObj) => {
        //         let jsonString = JSON.stringify(jsonObj, null, 2);
        //         let time = "";
        //         jsonObj.forEach((item, index) => {
        //             // console.log(item);
        //             if(item.field4.length){
        //                 if(isNaN(item.field4.charAt(0)))
        //                     time = item.field4;
        //                 else
        //                     time = timeFormating(item.field4);
        //             }
        //             if (item.field2.length) {
        //                 let temp = {
        //                     date: item.field2,
        //                     day: item.field3,
        //                     schedule: [],
        //                 };
        //                 newJSON.push(temp);

        //                 let courseTemp = extractCourseInfo(item.field5);

        //                 if (courseTemp) {
        //                     courseTemp.time = time;
        //                 }

        //                 newJSON[newJSON.length - 1].schedule.push(courseTemp);
        //             } else {
        //                 let temp = extractCourseInfo(item.field5);

        //                 if (temp) {
        //                     temp.time = time;
        //                 }
        //                 newJSON[newJSON.length - 1].schedule.push(Object(temp));
        //             }
        //         });

        //         jsonString = JSON.stringify(newJSON, null, 2);

        //         fs.writeFile(jsonFile, jsonString, (err) => {
        //             if (err) {
        //                 console.error("Error writing JSON file:", err);
        //             } else {
        //                 console.log("CSV file converted to JSON successfully!");
        //             }
        //         });
        //     })
        //     .catch((err) => {
        //         console.log(err);
        //     });
    // });