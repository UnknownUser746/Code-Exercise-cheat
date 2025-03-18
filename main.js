const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function loadExercises() {
    try {
        const rawData = fs.readFileSync('solutions.json', 'utf8');
        const solutionsData = JSON.parse(rawData);
        return solutionsData.exercises;
    } catch (error) {
        console.error("Error reading or parsing solutions.json:", error.message);
        process.exit(1);
    }
}

async function launchBrowser() {
    return await puppeteer.launch({
        headless: false,
        args: ['--start-maximized'],
        defaultViewport: null,
    });
}

async function login(page, cursor, username, password) {
    await page.goto('https://codeexercise.wenningstedt.dk/', { waitUntil: 'networkidle2' });

    await cursor.click('#ctl00_ContentPlaceHolder1_TB_UserName');
    await page.type('#ctl00_ContentPlaceHolder1_TB_UserName', username);

    await cursor.click('#ctl00_ContentPlaceHolder1_TB_Password');
    await page.type('#ctl00_ContentPlaceHolder1_TB_Password', password);

    await cursor.click('#ctl00_ContentPlaceHolder1_Button1'); // Login Button
    await new Promise(resolve => setTimeout(resolve, 8000));
}

function getUniqueExercises(exercises, count) {
    const shuffled = exercises.sort(() => 0.5 - Math.random()); // Shuffle array
    return shuffled.slice(0, count); // Pick 'count' number of exercises
}

async function solveExercise(page, cursor, exercise) {
    console.log(`Selected Exercise: ${exercise.name}`);

    
    await cursor.click(exercise.selector);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear text box before entering new solution
    await page.evaluate(() => {
        document.querySelector('#ctl00_ContentPlaceHolder1_TextBox1').value = '';
    });

    // Typing delay here because of Statistic view (Jakup)
    const solutionLength = exercise.solution.length;
    const minTime = exercise.typing_time.min * 1000; 
    const maxTime = exercise.typing_time.max * 1000;
    const totalTypingTime = Math.random() * (maxTime - minTime) + minTime; 
    const delayPerCharacter = totalTypingTime / solutionLength; 

    console.log(`Typing solution with an average delay of ${Math.round(delayPerCharacter)}ms per character.`);

    // Type new solution with realistic typing delay
    await page.type('#ctl00_ContentPlaceHolder1_TextBox1', exercise.solution, { delay: delayPerCharacter });

    console.log(`Code for '${exercise.name}' entered successfully.`);

    // Run Code
    await cursor.click('#ctl00_ContentPlaceHolder1_Button1');
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    await cursor.click('#ctl00_ContentPlaceHolder1_Button2');

    await new Promise(resolve => setTimeout(resolve, 5000));
    
    
}

(async () => {
    const exercises = await loadExercises();
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const cursor = createCursor(page);
    
    const username = "";            // Enter Username here
    const password = "";            // Enter Password here

    await login(page, cursor, username, password);

    //Change the range if you want to solve more exercises
    const numExercises = Math.floor(Math.random() * 4) + 2; 
    const selectedExercises = getUniqueExercises(exercises, numExercises);

    console.log(`Solving ${numExercises} exercises.`);

    // Solve each selected exercise
    for (const exercise of selectedExercises) {
        await solveExercise(page, cursor, exercise);
    }

    await browser.close();
})();
