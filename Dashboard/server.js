const express = require('express')
const axios = require('axios');
const cheerio = require('cheerio');
const socketIO = require('socket.io');
const { spawn } = require('child_process');

// redis
const Redis = require('ioredis');
const redis = new Redis();

const app = express();
app.use(express.static('public'))
app.set('view engine', 'ejs')
app.use(express.json());

// get the data Bright Star Catalog in JSON from gitHub
async function fetchDataFromGitHubAndInsertIntoRedis() {
  try {
    const url = 'https://raw.githubusercontent.com/aduboisforge/Bright-Star-Catalog-JSON/master/BSC.json';
    const response = await axios.get(url);
    const data = response.data;

    await redis.flushall();
    for (const entry of data) {
      await redis.hmset(entry['harvard_ref_#'], entry);
    }

    console.log("Data inserted into Redis");
  } catch (error) {
    console.error("Error fetching data from GitHub or inserting data into Redis:", error);
  } finally {
    // redis.quit();
  }
}
// execute the function that get the data
fetchDataFromGitHubAndInsertIntoRedis();


// get random entery from the Bright Star Catalog stored in redis
async function getRandomEntryFromRedis() {
  try {
    const redisKeys = await redis.keys('*');

    if (redisKeys.length === 0) {
      console.log('No entries found in Redis.');
      return null;
    }

    const randomKey = redisKeys[Math.floor(Math.random() * redisKeys.length)];
    const randomEntry = await redis.hgetall(randomKey);

    return randomEntry;
  } catch (error) {
    console.error('Error retrieving random entry from Redis:', error);
    throw error;
  }
}

// scrapping theskylive website
async function scrapping() {
  try {
    const response = await axios.get('https://theskylive.com/sun-info');
    const html = response.data;

    // Load the HTML content using Cheerio
    const $ = cheerio.load(html);

    ///////////////////////////////////
    // first part of the scrapping
    ///////////////////////////////////
    const riseData = $(".rise", html).text().trim().replace(/\t/g, '').split('\n');
    const transitData = $(".transit", html).text().trim().replace(/\t/g, '').split('\n');
    const setData = $(".set", html).text().trim().replace(/\t/g, '').split('\n');

    const rise = { status: riseData[1], [riseData[0].split(' ')[0]]: riseData[0].split(' ')[1], time: riseData[2] };
    const transit = { status: transitData[1], [transitData[0].split(' ')[0] + ' ' + transitData[0].split(' ')[1]]: transitData[0].split(' ')[2], time: transitData[2] };
    const set = { status: setData[1], [setData[0].split(' ')[0]]: setData[0].split(' ')[1], time: setData[2] };
    const data = { rise, transit, set };


    ///////////////////////////////////
    // second part of the scrapping
    ///////////////////////////////////
    const array = [];
    $('.data').each(function(index, element) {
      array.push($(element).text());
    });

    
    const first_table = array.slice(0, 6);
    const second_table = array.slice(6);

    const extractedFirstData = first_table.map(item => {
      const [PhysicalParameter, value, RelativeToEarth] = item
        .trim()
        .split('\n')
        .map(line => line.trim());
    
        return {
          PhysicalParameter,
          value,
          RelativeToEarth
        };
    });

    const extractedSecondData = second_table.map(item => {
      const [date, rightAscension, declination, magnitude, apparentDiameter, constellation] = item
        .trim()
        .split('\n')
        .filter(item => !/^\t+$/.test(item));

        return {
            date,
            rightAscension,
            declination,
            magnitude,
            apparentDiameter,
            constellation,
        };
    });
      
    ///////////////////////////////////
    // third part of the scrapping
    ///////////////////////////////////
    const srcArray = [];
    $('img').each(function(index, element) {
      srcArray.push($(element).attr('src'));
    });

    const baseUrl = "https://theskylive.com/";
    const sun = baseUrl + srcArray[4];
    const sky = baseUrl + srcArray[5];
    const images = { sun, sky }
    
    return { data, extractedFirstData, extractedSecondData, images };

  } catch (error) {
    return {}
  }
}

// get the last month neo
async function lastMonth() {
  const apiKey = "07D064f7cWtk8FCfHLBgWBZr4KS4egUbZ32wlrzt"

  try {
    const currentDate = new Date();
    var year = currentDate.getFullYear();
    var month = String(currentDate.getMonth() + 1).padStart(2, '0');
    var day = String(currentDate.getDate()).padStart(2, '0');
    var end_date = `${year}-${month}-${day}`;

    currentDate.setDate(currentDate.getDate() - 31);
    year = currentDate.getFullYear();
    month = String(currentDate.getMonth() + 1).padStart(2, '0');
    day = String(currentDate.getDate()).padStart(2, '0');

    start_date = `${year}-${month}-${day}`;

    const response = await fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${start_date}&date-max=${end_date}&sort=h`);
    const data = await response.json();
    return data;

  } catch (error) {
    console.log('Error fetching data:', error);
    return {}
  }
}

// get the next 24 hours neo
async function next24() {
  const apiKey = "07D064f7cWtk8FCfHLBgWBZr4KS4egUbZ32wlrzt"

  try {
    const currentDate = new Date();
    var year = currentDate.getFullYear();
    var month = String(currentDate.getMonth() + 1).padStart(2, '0');
    var day = String(currentDate.getDate()).padStart(2, '0');
    var start_date = `${year}-${month}-${day}`;

    currentDate.setDate(currentDate.getDate() + 2);
    year = currentDate.getFullYear();
    month = String(currentDate.getMonth() + 1).padStart(2, '0');
    day = String(currentDate.getDate()).padStart(2, '0');

    end_date = `${year}-${month}-${day}`;

    const response = await fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${start_date}&date-max=${end_date}&sort=date`);
    const data = await response.json();

    data.fields.splice(9, 1);
    data.data = data.data.map(row => row.map(value => {
      const parsedValue = parseFloat(value);
      return isNaN(parsedValue) || Number.isInteger(parsedValue) ? value : parsedValue.toFixed(1);
    }));

    data.data = data.data.map(row => {
      row.splice(9, 1);
      return row;
    });

    return data;

  } catch (error) {
    console.log('Error fetching data:', error);
    return {}
  }
}

async function buildQuery(query) {

  var queryData = null;
  if(query) {

    // extract date from query
    var date = {
      "gt": query['start-date'],
      "lt": query['end-date'],
    };
    delete query['start-date'];
    delete query['end-date'];

    

    // remove the the fields that were not selected
    for (const key in query) {
      if (query[key] === 'choose') {
        delete query[key];
      }
    }

    // if any fields were not selected
    if( JSON.stringify(query) === '{}') {
      queryData = {
        size: 1000,
        query: {
          range: {
            date: date
          }
        }
      };

      return queryData;
    }

    // add suffix ".keybord" to the query's keys
    for (const key in query) {
      query[`${key}.keyword`] = query[key];
      delete query[key];
    }

    // Convert data object into an array of objects with the required format
    var must = Object.keys(query).map(key => {
      const obj = {
        term: {
          [key]: query[key]
        }
      };
      return obj;
    });

    must.push({
      range: {
        date
      }
    });

    queryData = {
      size: 1000,
      query: {
        bool: {
          must: must
        }
      }
    };
    
  } else {
    queryData = {
      size: 1000
    };
  }

  return queryData;
}

async function readElasticSearch(query) { 
  const baseUrl = 'https://oriya-and-niv-2114271212.us-east-1.bonsaisearch.net:443';
  const username = '5gcyxc4555';
  const password = 'jn152uisr8';
  
  // Creating a basic authentication header with the provided username and password
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  var queryData = await buildQuery(query);

  // Making a POST request to the URL with the authentication header and query data
  try {
    const response = await axios.post(`${baseUrl}/sample_index/_search`, queryData,  {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('Query successful!');
    const data = response.data.hits.hits.map(hit => hit._source);
    return data;

  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}

// help function for sort an array contains dates
function compareDates(a, b) {
  const dateA = new Date(a[0]);
  const dateB = new Date(b[0]);

  // First, compare dates
  if (dateA < dateB) return -1;
  if (dateA > dateB) return 1;

  // If dates are equal, compare times
  const timeA = parseFloat(a[1]);
  const timeB = parseFloat(b[1]);

  return timeA - timeB;
}

// function to get the most recent date and time
async function getMostRecentDateTime() {
  const baseURL = 'https://oriya-and-niv-2114271212.us-east-1.bonsaisearch.net';
  const indexName = 'sample_index';
  const username = '5gcyxc4555';
  const password = 'jn152uisr8';

  try {
    const response = await axios.get(`${baseURL}/${indexName}/_search`, {
      auth: {
        username,
        password
      },
      params: {
        size: 1,
      },
      data: {
        query: {
          match_all: {}
        },
        sort: [
          {
            date: {
              order: "desc"
            }
          },
          {
            "time.keyword": {
              order: "desc"
            }
          }
        ]
      }
    });

    // The most recent document will be available in the response.data.hits.hits array
    if (response.data.hits.hits.length > 0) {
      return response.data.hits.hits[0]._source;
    } else {
      console.log('No documents found in the index.');
    }
  } catch (error) {
    console.error('Error retrieving data from Elasticsearch:', error.message);
  }
}

// 
async function simbad(ra, dec) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = 'python'; // Replace 'python' with the appropriate command for running Python on your system
    const scriptPath = 'C:\\Users\\oriaz\\Desktop\\big_data\\Dashboard\\simbad.py'; // Replace with the actual path to your Python script

    const pythonProcess = spawn(pythonExecutable, [scriptPath, ra, dec]);

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      // console.log('Python script output:', data.toString());
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python script error:', data.toString());
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // console.log('Python script exited with code:', code);
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Python script exited with code ${code}. Error: ${error.trim()}`));
      }
    });
  });
}

//////////////////////////////////////////
// pages
//////////////////////////////////////////
app.get('/', async (req, res) => {
  const scrapy = await scrapping();
  const last_month = await lastMonth();
  const dataFromES = await readElasticSearch();

  const filteredData = last_month.data.map(item => [item[3], item[10]]);
  filteredData.sort(compareDates);

  const sunData = { currentDate: '2023-07-18 15:30', json: scrapy.data };

  const extractedFirstData = scrapy.extractedFirstData;
  const extractedSecondData = scrapy.extractedSecondData.map(item => {
    return {
      date: item.date.trim(),
      apparentDiameter: item.apparentDiameter.trim()
    };
  });
  const images = scrapy.images;

  const last_event = await getMostRecentDateTime();

  try {
    const dataFromSimbad = await simbad(last_event.RA, last_event.DEC);
    const dataFromSimbadArr = dataFromSimbad.split('\n');
    for(const entry of dataFromSimbadArr) {
      const key_and_val = entry.split(": ");
      last_event[key_and_val[0]] = key_and_val[1];
    }

    res.render("pages/dashboard", {
      sunData,
      filteredData,
      dataFromES,
      extractedSecondData,
      extractedFirstData,
      images,
      last_event
    });
  } catch (error) {
    console.error("Error in simbad function:", error);
    // Handle the error appropriately (e.g., send an error response)
    res.status(500).send("An error occurred.");
  }

})

app.get('/searchEvents', async (req, res) => {
  const list = [
    'F7-9V', 'A3-5I', 'K3', 'A2Vs', 'B8IVS', 'K2IVa', 'G1Ib-', 'F0IVD', 'A7mSr', 'B8/9I', 'B8Vnn', 'A3/4V', 'K2IV', 'M3.5I', 'G9-II', 'B6III', 'B1Ibe', 'BepSh', 'F1III', 'B8', 'F0Vam', 'B1Vp', 'B1-2I', 'F5Vb', 'F2Iae', 'K3:+B', 'A1V+F', 'A1m', 'A0IVp', 'B6V+F', 'A5m', 'A1Ia', 'A3-5m', 'G5-6I', 'B0II', 'B9V', 'B4IV', 'M3II', 'B9V+B', 'G8II', 'A0p', 'G9V', 'F3IV+', 'F8II', 'G0-1I', 'F2V:', 'A6VpS', 'B3Iab', 'A3Vn', 'B6Vn', 'B8Si', 'A8n', 'F9IV', 'B5/6I', 'B6IV-', 'K3-II', 'A5mDe', 'B5Ia', 'dF4', 'B6Iae', 'A1Vnn', 'A6IV', 'B3V+B', 'B6II', 'ApHgM', 'A0VpS', 'G8Vp', 'B0.3I', 'A3V:+', 'C6II', 'A4IV-', 'G2Ib+', 'G9IV-', 'B6Iab', 'A1IV', 'G6.5I', 'M2.5I', 'K3-Ib', 'gG7', 'A2V+K', 'B1Vne', 'B9Vnn', 'A7Ib', 'F5IVD', 'A4n', 'A3IVn', 'F0Iae', 'A3Ib', 'A1V+B', 'G3IIp', 'B0IV:', 'F5IV-', 'G3.5I', 'F2IV-', 'B7Vn', 'G3III', 'A1pSr', 'F9V+d', 'A7IV', 'A0Ia', 'A0Vnn', 'G0IIa', 'G1Ib', 'B2IV-', 'B8V', 'A2Vpn', 'M8III', 'N0:', 'B9V+A', 'K3III', 'B4Vp', 'K5II', 'K2Ib', 'B8/9V', 'cK2', 'A0Vs', 'B8IVp', 'F8Vb', 'A2Vm', 'B5V+F', 'F8.5I', 'M1Ib', 'G40-I', 'B0IV', 'M2Iae', 'G6Ib-', 'B5Vp', 'K1IV+', 'B0.5V', 'A4III', 'A0V+A', 'B6V', 'A2IVm', 'K4I:', 'K6', 'A3', 'F1-3V', 'K2II', 'ApEuC', 'M1-2I', 'A2Si3', 'B2Vn', 'gG5', 'K1II', 'K3.5I', 'K7III', 'M1.5I', 'A5p', 'gK7', 'Ap', 'A5pSr', 'O7V((', 'A0p:H', 'G0-V', 'S5,7e', 'A3Vm', 'F8VFe', 'B9Ve', 'O9.5e', 'F0Vp', 'B6Ve', 'B9Vn', 'F7V+G', 'A4.5V', 'A0pSi', 'A1Ib', 'B2pe', 'F7.5I', 'F6IIp', 'G8II/', 'M7-8S', 'F5:Ib', 'A2IVn', 'O9Vn', 'F6IV:', 'F5V+F', 'F0Ia', 'B2II-', 'A4/7V', 'G0Ia-', 'F8III', 'A0Ia-', 'dF6', 'M2II-', 'A3V+F', 'F2Ib-', 'A1mA5', 'B2V', 'A3pSr', 'B1Ia', 'dF2', 'A5Del', 'A2IV', 'G4V', 'FmDel', 'G0VFe', 'A9V', 'M5III', 'B5Ib', 'A4:pe', 'A0p:', 'B1ne', 'G7.5I', 'K4II-', 'M4.5-', 'A4V', 'B9Ib-', 'B9Ia', 'F3-5I', 'dBe+gM', 'S3+/2', 'B9p:M', 'A0VSi', 'F6V', 'gG5+F', 'K2+II', 'K4Ib', 'B0Ib', 'K2III', 'A5-F1', 'F0Del', 'F6V+F', 'A8m', 'K2/3I', 'A6pCr', 'B6Vp', 'K3Ib+', 'dA6', 'O6.5V', 'B7IV-', 'F2-3I', 'A4m:', 'B7II', 'G0V:', 'G8.5I', 'B1.5V', 'A9IVD', 'F3Vp', 'M0-1I', 'B9II', 'G0II-', 'K0Ibp', 'G1V+G', 'M2-II', 'gG8', 'B7Ve', 'gK2', 'A1pEu', 'G1V', 'F3V+A', 'A6II-', 'K0.5I', 'A0IVM', 'A3+F0', 'G6IV-', 'K3Ib', 'B9Si', 'F2Vp', 'B3III', 'A1V', 'A3Iab', 'G8V', 'B9VSi', 'B9pSi', 'G8/K0', 'gK+F', 'B3ne', 'B9.5V', 'K0III', 'gM0', 'A2V:', 'K3IV', 'K5Ib', ':G9', 'B7V+A', 'A8V+F', 'K3+II', 'F3III', 'F1V', 'K4II+', 'dF5', 'A7V:', 'B1Vp+', 'G30-I', 'S3.9e', 'A3Ia', 'B5V:', 'F1Ia', 'K0V', 'M6III', 'M7III', 'B1IV+', 'O7V+O', 'A3IV-', 'B5IV+', 'S4+/1', 'A3/6V', 'F5IV:', 'F6III', 'G5IV+', 'B8Vnp', 'gM1', 'G7III', 'B2Ve', 'M1II', 'B2IV:', 'A0', 'F8IV:', 'F7-G3', 'A3V+G', 'gG3', 'F2III', 'Am,A5', 'A2V+A', 'A0-1I', 'B3Vn', 'B6-7V', 'B9V+F', 'K1-II', 'B9Vne', 'B5Vn', 'A0V+F', 'M2Iab', 'K1-2I', 'gK3', 'G2Va', 'B2Vp', 'F3IV-', 'F4III', 'B2Ib', 'B7IV', 'B8II', 'A2Vp', 'G2Ib', 'A5V+A', 'A0IV+', 'F1II', 'B9Vs', 'B0III', 'A1IVp', 'M1II-', 'A0Vnp', 'M0.5I', 'G5Ib+', 'A0VnD', 'G5', 'G6IbH', 'B8Ve', 'G2.5V', 'F2Vn', 'F0Vnn', 'B1Ve', 'A8Vn', 'A8IV', 'A9III', 'K4-5I', 'F2I', 'G3V', 'A7p', 'K7Ib', 'A8I-I', 'A1Vnp', 'K5II-', 'M0II+', 'F3:V', 'A1III', 'F4V:', 'A5Ib', 'B5II-', 'K1V', 'F0Iab', 'A7/8V', 'A3m+A', 'F5I-I', 'K1pII', 'B8IV', 'F2-F8', 'B4Ve', 'A6V', 'K2IIp', 'B8.5V', 'A0III', 'B9Iab', 'F3Ib', 'F5Ia', 'M6-II', 'G1-2V', 'O7.5V', 'A1Vp:', 'A2-3V', 'F7V', 'A0IV', 'A2/3I', 'A5V', 'A9.5I', 'F1IV', 'F7Vn', 'A2Vp:', 'A7III', 'G2V+G', 'B1Ib', 'B9VpS', 'G9.5I', 'G1IV', 'K0Ib+', 'F3V:', 'F6IV', 'B1III', 'G7II-', 'B3e', 'F8V+G', 'B9p', 'B7III', 'G6Ib', 'O5III', 'dF0', 'G5IV', 'F3-4V', 'K1II/', 'B1Iab', 'B1Vpe', 'G3-5V', 'G5:II', 'B7-8V', 'K2II+', 'G0-2V', 'A9mA8', 'G9IVa', 'K2II-', 'A3II-', 'B8V-I', 'K2Ib-', 'G6V', 'O9V', 'A3Vnp', 'B8Vn', 'B8IVn', 'M5IIb', 'B5Iab', 'F3Vn', 'O8p', 'A0-3I', 'B1II', 'M3-4I', 'A2IV-', 'G5IV-', 'M2+II', 'F5Iab', 'A5-7m', 'K1IIe', 'gK5', 'ApSi*', 'F7:Ib', 'K4.5I', 'B9.5I', 'B1IVe', 'F9III', 'G8IIa', 'B7IVe', 'F7Ib-', 'F0Vs', 'G2IV', 'F7IV', 'F4II-', 'F6-8V', 'B5IV', 'K0', 'F3IV', 'B1V', 'F5-6V', 'K7V', 'B9Ib', 'K6III', 'F5Ib', 'G8IIb', 'O9Ib-', 'A2mA2', 'B2V+B', 'G8IV', 'A5IV-', 'F0IV-', 'G6Iab', 'A0Vm:', 'B9pe', 'M3-II', 'M4-II', 'M1+II', 'F9-G1', 'A2pSh', 'A9IV-', 'C3II', 'M5IIe', 'K3I-I', 'B8Iap', 'A0II', 'B3V+F', 'F5Del', 'S4/1I', 'F2Iab', 'F5II-', 'F7Vw', 'F0m', 'F9IV-', 'ApCrE', 'F3-4I', 'A6III', 'B8Vpe', 'G8IVH', 'F5mDe', 'A5Vm', 'G0Iep', 'M2II+', 'K2IIC', 'O7Ia:', 'F7II', 'A0Iae', 'G4Ib', 'B0V:p', 'G1.5V', 'K1I', 'A2II', 'F5IV', 'O9Ib', 'G2.5I', 'K2IIb', 'G3IV', 'M4II', 'F5II', 'B4Vne', 'A8III', 'G7Ib-', 'F0IVm', 'B8II/', 'F9Ia', 'A2III', 'M3II-', 'A/FmD', 'G2III', 'F9Vn:', 'M5Ib-', 'B1IV', 'A6IV-', 'A3V+A', 'A7V:m', 'F6II', 'K5-II', 'A3V', 'K4-5V', 'B3Vpe', 'F4IV+', 'G8-K0', 'F3Ia', 'F7-8I', 'F9V', 'F5Ib-', 'gF0', 'M0II', 'G1III', 'M4+II', 'A8Vs', 'G5Ib', 'A8-9I', 'O6I(n', 'F7Iab', 'F8I', 'A0-1:', 'B9', 'B9.5p', 'F2-6V', 'B8IIp', 'A6Iae', 'G2II', 'A2m', 'G6/8I', 'K3II', 'G3Ib+', 'F6Vb', 'K5III', 'A8V', 'F6Va', 'M1', 'K2V', 'M6-7I', 'A3Vs', 'B8p', 'A9IV', 'A3Vnn', 'O8:Ia', 'A1-2V', 'G5Iab', 'K3/4I', 'G0:II', 'G7.5V', 'M4III', 'K3Ib-', 'F8Vs', 'B8IV-', 'G5Ia+', 'K1+IV', 'G4IIa', 'G40', 'M6.5I', 'B3V+A', 'ApSi', 'B7Iae', 'M1IIa', 'A2Vnn', 'A7pSr', 'A7-F0', 'G8+II', 'A7IV-', 'M0III', 'G9Ib', 'B3IV', 'B9npE', 'B9pCr', 'A7IVn', 'A9Vp', 'A4/5I', 'F1Vp', 'F4-G1', 'A9V:', 'K1Ib-', 'B6V+B', 'F3V', 'K5I:', 'B2-3I', 'M4.5I', 'O9III', 'O9.5V', 'F3-F5', 'A6Ib', 'A3Iae', 'G9+II', 'A0IV-', 'A1VN', 'K3IIb', 'K3-4I', 'B2IV+', 'A9Vm', 'A0V+B', 'A2mA5', 'A8Vn-', 'A5Vp', 'B8Ib', 'G3II-', 'F9II', 'K0/1I', 'A8II-', 'G20e', 'G4IV-', 'G3VaH', 'A6pSr', 'B1II-', 'F1/6V', 'A9Vs', 'F8IV', 'K2+Ia', 'B2Ven', 'F2V+F', 'G9III', 'B2V:n', 'K1IIa', 'A0V', 'A0eSh', 'B3IVe', 'A0Vn', 'M0V', 'F4Vv', 'G0Ipe', 'B4III', 'K1.5I', 'B2IVe', 'K1Ib', 'F8Ib', 'M1-II', 'K0II', 'A0Ib-', 'C6.3', 'G5V', 'G00-I', 'A8V:', 'F6-7I', 'K0+II', 'K2IV-', 'G0.5I', 'A5n', 'K2.5I', 'G5IV:', 'O9.5I', 'A5Vn', 'G8-II', 'B3II', 'B9IV+', 'F0IVn', 'B7V+B', 'A2Ia', 'B3Vne', 'G20-I', 'M3IIb', 'F9.5V', 'G2IV+', 'B0Vn', 'G5IIa', 'F5V:', 'A2', 'B8Ia', 'G5.5I', 'WC8+O', 'A0pSr', 'G5VbF', 'A1VpS', 'B3Vnp', 'F7-G1', 'B2Ia', 'A9-F0', 'A2eSh', 'B3II-', ':F2', 'B7-8I', 'A6Vn', 'G4IV', 'A2Iab', 'K1+II', 'A7IVe', 'M2-Ia', 'B9IVM', 'A6II', 'O7III', 'A2-3I', 'F2II', 'F6IV-', 'G5IIb', 'F2Vw', 'F2VDe', ':F0', 'B1Iap', 'A7/8I', 'B5III', 'B3Ia', 'K0-2I', 'F2-6I', 'AmA3-', 'F0p', 'S3.5/', 'dA9n', 'A0Va', 'F6II-', 'G3II', 'gF2', 'B4IVp', 'F4V', 'K2-II', 'B8V+B', 'G5-8I', 'G6-8I', 'F4Iab', 'F5V', 'F7III', 'F4IV', 'Am', 'B2II', 'B5II', 'KIII', 'B1.5I', 'F0Ib', 'K0-II', 'F6II+', 'A7m', 'M4-5I', 'G0Ib-', 'O9.7I', 'gG6', 'F2IV', 'K1', 'F2-3V', 'B8III', 'G2V', 'G8', 'B2Vpe', 'K1IVC', 'G5II:', 'F0II', 'K4V', 'O4V((', 'B9III', 'K4-II', 'A1pCr', 'G8pBa', 'B9pMn', 'B9IV-', 'A1IV-', 'B8Ia-', 'gK1', 'G5II', 'G0Va', 'A1Vp', 'K0+IV', 'O6V((', 'A0V+G', 'G8Ib', 'WN5-B', 'F2IV+', 'K2I+B', 'A3m', 'A5-F2', 'B4V', 'A3She', 'F0V', 'B4Vn', 'G5Vb', 'G7V', 'B9Vn:', 'A9II', 'dG6', 'G0IV-', 'GIII+', 'A0-1V', 'K5', 'F2Ib', 'M0II-', 'B3IV:', 'O8III', 'B0.5I', 'B6IVe', 'O9Ia', 'A1V+A', 'A5II', 'B4Ia', 'G4III', 'M2III', 'B7II-', 'A2II-', 'B7Vne', 'G6IV+', 'A1', 'K5.5I', 'B9-A0', 'A0pHg', 'K0-1I', 'G1.5I', 'F5III', 'F2V', 'B1V+B', 'A3IVp', 'A0Vp', 'B7IVn', 'G0VCa', 'K1-IV', 'M4IIb', 'A4mDe', 'G2II-', 'B5Vnn', 'M1Ibe', 'K1p', 'F2-4I', 'B8Ia:', 'A4Vm', 'K00-I', 'B2IVp', 'A3-4V', 'F6-7V', 'gF0n', 'F8-G0', 'A1eSh', 'F2/3I', 'B7V', 'A3II', 'B8II-', 'A9Vn', 'G9II', 'K1-V', 'G6II', 'M1+Ib', 'B3Ve', 'G3Va', 'A0Ve', 'F8-G2', 'B9p:H', 'G0Vs', 'A0pCr', 'A4Vn', 'A1Vn', 'G0V:e', 'G1IVb', 'M3III', 'K2', 'B0V', 'A1pSi', 'K2IVC', 'F5Vs', 'K1II-', 'B8V+A', 'K1Ia-', 'B8IVH', 'G0V', 'B9IVn', 'A0Iab', 'dF7', 'B8-9I', 'B6Ib', 'A5IV', 'O8Iaf', 'F0-2V', 'K4III', 'B6Vnp', 'K0e-M', 'G6IV', 'F5-6I', 'gG4', 'A7Vn', 'O5f', 'B8Vs', 'K3V', 'A4IVn', 'G3Ia', 'ApSrE', 'A8IVp', 'G3II+', 'F7IV-', 'G0+Va', 'ApSrC', 'F8IV-', 'A2Ib', 'G7-II', 'Am(A2', 'G8IV-', 'G7+II', 'A2V+F', 'K0II-', 'B6Vnn', 'F0Vn', 'K3II-', 'F0', 'A5Ia', 'G1II', 'F5IV+', 'G2-3I', 'G8II-', 'F0III', 'K1IIC', 'F6Vs', 'K3II+', 'G8III', 'B2.5V', 'A4m', 'G0-5+', 'B2III', 'A1n', 'G5II-', 'M8eII', 'B5:V', 'F3Vs', 'B9pEu', 'B0IVe', 'G5Ia', 'F4IV-', 'K5:II', 'gA9', 'M0Ib-', 'G0Ib', 'M2-3I', 'A2Vm:', 'A2Vn', 'G3IV-', 'S6+/1', 'G9II-', 'A7s', 'B3Ib', 'K2-3I', 'A7V+F', 'B2Vep', 'pec', 'K0I', 'A2p', 'B9II-', 'G8IIp', 'A3Vp', 'B4IVe', 'G6II-', 'G9IV', 'B6V+A', 'B0Vp', 'F8Ib-', 'A0Ib', 'G8-K1', 'F6Ib', 'G9Ib*', 'F1IV-', 'S6.5I', 'B8Vp:', 'B8VpS', 'A4V+A', 'G1-VF', 'G3IV+', 'gG9', 'A0IVn', 'A8Vma', 'A7V:n', 'F6Ib-', 'gK0', 'F8V+A', 'A7Vm', 'B9pHg', 'K0IV', 'A0II-', 'F5Va', 'F4Vw', 'A3Vm+', 'B6IV', 'F7IVb', 'G7II', 'K0+V', 'F5Vn', 'A2V', 'F8V', 'B9.5-', 'A1V+G', 'B1Iae', 'A5/7V', 'F1IVn', 'A3IV', 'F0-2I', 'B5Vne', 'M4.5:', 'F0VDe', 'K3IIa', 'B8Ib-', 'WN7-A', 'B3V', 'B2IV', 'K5V', 'B2IVn', 'G5I', 'B0Ia+', 'G0IV', 'A8:mD', 'F7Ib', 'A3Del', 'A2Vnp', 'F5', 'B7V+G', 'G8:II', 'K0Ib', 'M3II+', 'F5V+G', 'K5-M0', 'C7I', 'M5II-', 'S7.3e', 'M3+II', 'G2-6I', 'A1Vm', 'O8.5V', 'G6III', 'B4IVn', 'A2VpS', 'G0.5V', 'B3-5I', 'K1IVa', 'F0IV', 'F2IVa', 'K4+II', 'M1III', 'A8Ib', 'G0III', 'A2VpC', 'M5.5I', 'G8Ve+', 'K2Ib+', 'G3Ib', 'F3V+F', 'B3IVp', 'A7V', 'G7IV', 'K4II', 'B4Vnp', 'F0V+F', 'A3mA5', 'B4Ven', 'B9IVp', 'F3II-', 'G5III', 'G0', 'A1Vs', 'A4IV', 'B5IVn', 'F6Ia', 'B2.5I', 'C5II', 'G2Ib-', 'F0pSr', 'C5,5', 'G8IV:', 'K4I', 'B5V', 'B5Ve', 'F2IIp', 'F7V:', 'F8Ia', 'K4Ib-', 'M0-II', 'C6IIe', 'G8Ib-', 'F7', 'B8Vne', 'B8-9V', 'O7.5I', 'A7Iab', 'B6IVn', 'G3Ib-', 'A3III', 'A6m', 'K5+II', 'WC7+O', 'F2', 'F7IV+', 'A2pSr', 'G5Ib-', 'B0Ia', 'K1III', 'F2II-', 'F0V:', 'K1IV', 'A5Vs', 'M0+II', 'A5III', 'K3V+K', 'G7:II', 'gK4', 'K1IVF', 'Am+Am', 'K0IbH', 'B2Vne', 'K1IV-', 'B8n', 'gK6', 'O6p', 'K4II:', 'B9IV', 'A9Ia'
  ];
  list.sort();
  const titels = ["id", "planetarium", "events_type", "Title_HD", "RA", "DEC", "date", "time", "urgency"];
  const dataFromES = await readElasticSearch();
  // console.log(dataFromES);

  res.render("pages/searchEvents", {list, titels, dataFromES});
});

app.post('/searchEvents', async (req, res) => {
  const query = req.body;
  const dataFromES = await readElasticSearch(query);
  res.json(dataFromES);
})

app.get('/sunEvents', async (req, res) => {
  const scrapy = await scrapping();
  const table = scrapy.extractedSecondData;
  res.render("pages/sunEvents", {table});
})

app.get('/neo', async (req, res) => {
  const next_24 = await next24();
  res.render("pages/neo", {next_24} );
})


//////////////////////////////////////////
// target for the simulator server
//////////////////////////////////////////
app.get('/getStar', async (req, res) => {
  try {
    const randomEntry = await getRandomEntryFromRedis();
    res.json(randomEntry);
  } catch (error) {
    console.error('Error retrieving random entry from Redis:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/check', async (req, res) => {
  // const dataFromES = await eses();
  // console.log("ret4tre: ", dataFromES);
  res.json(dataFromES);
  // res.render("pages/check", dataFromES);
})

const server = express()
  .use(app)
  .listen(3000, () => console.log(`Listening Socket on http://localhost:3000`));
const io = socketIO(server);
