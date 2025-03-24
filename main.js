const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');
const fs = require('fs');

puppeteer.use(StealthPlugin());






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






async function filterAvailableExercises(page, exercises) {
    const availableExercises = [];

    for (const exercise of exercises) {
        const elementHandle = await page.$(exercise.selector);

        if (elementHandle) {
            const isDisabled = await page.evaluate(el => el.hasAttribute('disabled'), elementHandle);

            if (!isDisabled) {
                availableExercises.push(exercise);
            } else {
                console.log(`Exercise '${exercise.name}' is disabled.`);
            }
        } else {
            console.warn(`Selector not found for '${exercise.name}': ${exercise.selector}`);
        }
    }

    return availableExercises;
}






function getUniqueExercises(exercises, count) {
    const shuffled = exercises.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}








async function solveExercise(page, cursor, exercise) {
    console.log(`Selected Exercise: ${exercise.name}`);

    await cursor.click(exercise.selector);
    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.evaluate(() => {
        document.querySelector('#ctl00_ContentPlaceHolder1_TextBox1').value = '';
    });

    const solutionLength = exercise.solution.length;
    const minTime = exercise.typing_time.min * 1000;
    const maxTime = exercise.typing_time.max * 1000;
    const totalTypingTime = Math.random() * (maxTime - minTime) + minTime;
    const delayPerCharacter = totalTypingTime / solutionLength;

    await page.type('#ctl00_ContentPlaceHolder1_TextBox1', exercise.solution, { delay: delayPerCharacter });

    console.log(`Code for '${exercise.name}' entered successfully.`);

    await cursor.click('#ctl00_ContentPlaceHolder1_Button1');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await cursor.click('#ctl00_ContentPlaceHolder1_Button2');
    await new Promise(resolve => setTimeout(resolve, 5000));
}






async function detectNewExercises(page, knownExercises) {
    const knownSelectors = new Set(knownExercises.map(ex => ex.selector));
    const allButtons = await page.$$('[id^="ctl00_ContentPlaceHolder1_ButtonExecise"]');

    const newExercises = [];

    for (const btn of allButtons) {
        const selectorId = await page.evaluate(el => el.getAttribute('id'), btn);
        const selector = `#${selectorId}`;

        const isDisabled = await page.evaluate(el => el.hasAttribute('disabled'), btn);
        const name = await page.evaluate(el => el.innerText.trim(), btn);

        if (!knownSelectors.has(selector) && !isDisabled) {
            newExercises.push({
                name: name || `Unknown - ${selectorId}`,
                selector,
                solution: "", 
                typing_time: { min: 50, max: 70 }
            });
        }
    }

    return newExercises;
}








(async () => {
    const exercises = await loadExercises();
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const cursor = createCursor(page);

    const username = "";                // Username here
    const password = "";                // Password here

    await login(page, cursor, username, password);

    await page.waitForSelector('#ctl00_ContentPlaceHolder1_ButtonExecise001', { timeout: 10000 }).catch(() => {});

    // Detect new exercises
    const newExercises = await detectNewExercises(page, exercises);

    if (newExercises.length > 0) {
        console.log("New exercises found on the page that are NOT in your solutions.json:");
        console.log(JSON.stringify(newExercises, null, 2));
        fs.writeFileSync('new_exercises_found.json', JSON.stringify(newExercises, null, 2));
    }

    // Only include new ones that have solutions
    const combinedExercises = [...exercises, ...newExercises.filter(e => e.solution && e.solution.length > 0)];

    const availableExercises = await filterAvailableExercises(page, combinedExercises);

    if (availableExercises.length === 0) {
        console.error("No available exercises found on the page.");
        await browser.close();
        return;
    }

    const numExercises = 6 //Math.min(Math.floor(Math.random() * 4) + 2, availableExercises.length);
    const selectedExercises = getUniqueExercises(availableExercises, numExercises);

    console.log(`Solving ${numExercises} available exercises.`);

    for (const exercise of selectedExercises) {
        await solveExercise(page, cursor, exercise);
    }

    await browser.close();
})();
