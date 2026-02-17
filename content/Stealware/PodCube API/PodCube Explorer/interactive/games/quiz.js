// =============================================================================
// QUIZ - Timed Trivia
// =============================================================================

class QuizGame extends Game {

    static meta = {
        title: "PodCube™ Trivia",
        desc: "Test your knowledge about the daily operations of the PodCube™ Research & Innovation Campus.",
        instructions: "Select the correct answer before time runs out."
    };

    constructor(api) {
        super(api);


        this.allQuestions = [
            { q: "Who are the two founders of PodCube™?", a: ["Jimley Huffman and Dick Blakely", "Mason Amadeus and Jordan Marshall", "Gregor Solitaro and Dustin Agrububger"], c: 0 },
            { q: "In what year did the founders first envision the time sphere for their 8th-grade science fairs?", a: ["2048", "2027", "2046"], c: 1 },
            { q: "What is the full name of the PodCube™ headquarters?", a: ["The PodCube™ Center", "PodCube™ Research and Innovation Campus (PRIC)", "The Huffman Rotunda"], c: 1 },
            { q: "Where is the PRIC located?", a: ["A skyscraper in New York", "An artificial island off the coast of Miami", "Underground in Kentucky"], c: 1 },
            { q: "What powers the entire PRIC campus?", a: ["Nuclear fusion", "Solar panels and wind", "Hydroelectrics and alligator movement"], c: 2 },
            { q: "As of the year 2100, how many alligators are part of the PodCube™ conservation program?", a: ["10,000", "45,000", "100,000"], c: 1 },
            { q: "What are the names of the four groups of alligators at the PRIC?", a: ["Jim, Dick, Prabo, and Stove", "Rachel, Tyler, Bradley, and Carol", "Alpha, Beta, Gamma, and Delta"], c: 1 },
            { q: "What is the official fermented beverage of the PRIC?", a: ["Sprot™", "Taco Water", "Savigarot Wine"], c: 0 },
            { q: "How many vitamins and minerals are packed into a single can of Sprot™?", a: ["550", "5,500", "Over 55,000"], c: 2 },
            { q: "What is the name of the three-dimensional model of the universe discovered by the founders?", a: ["The Tesseract of existence", "The Blakely-Huffman Spheroid (BHS)", "The ISWORM"], c: 1 },
            { q: "What term describes a point where an infinite amount of possible futures share identical probability distributions?", a: ["Temporal Junction", "Actualization Anomaly", "The Fray"], c: 1 },
            { q: "What is the 'ISWORM' otherwise known as?", a: ["The Literal Occurrence Graph (LOG) log log", "The Temporal Map", "The Spacetime Rope"], c: 0 },
            { q: "What is the shape of the 'tesseract of existence' according to internal notes?", a: ["A cube", "A sphere", "A turd"], c: 2 },
            { q: "Which department is responsible for receiving and processing transmissions from deployed PodCube™s?", a: ["Galileo Deployment", "Brigistics", "pSEC"], c: 1 },
            { q: "What is the name of the internal instant messaging service at PodCube™?", a: ["PodMail", "PodChat", "PRIC-Link"], c: 1 },
            { q: "Who holds the title of Corporate Cool Officer (CCO)?", a: ["Stove", "Prabo", "Swartz Plander"], c: 1 },
            { q: "What is Stove's official title at PodCube™?", a: ["CEO", "Cool Community Outreach Person (CCOP)", "Head of Alignment"], c: 1 },
            { q: "Which department is responsible for the Galileo Drone Deployment system?", a: ["Brigistics", "Galileo Deployment", "R&D&R&P"], c: 1 },
            { q: "What is the name of the AI that provides outros for many PodCube™ transmissions?", a: ["Olivia", "Tyler", "Crummy13"], c: 2 },
            { q: "What does the number '13' in Crummy13 represent?", a: ["Their creation date", "The operating system they are running", "Their rank in the AI department"], c: 1 },
            { q: "Which department does Dick Blakely lead?", a: ["Corporate Cool", "PSEC", "Temporal Untidiness Redress Directive"], c: 2 },
            { q: "What is the name of the outdoor recreational path for employees at the PRIC?", a: ["The Nature Loop", "Ravioli Walkabout", "The Alligator Run"], c: 1 },
            { q: "What experimental pineal implant auto-plays PodCube™ transmissions for the user?", a: ["The BHS Link", "HORUS", "The Pineal Pod"], c: 1 },
            { q: "How long does a PodCube™ device become useless if the 'back flap' is tampered with?", a: ["4 years", "6 months", "Forever"], c: 0 },
            { q: "What is the name of the fuel cell used in Galileo Drones?", a: ["CoreN (Corn Core)", "Q-Bit Cell", "Adiabatic Battery"], c: 0 },
            { q: "How many staff bathrooms are located throughout the PRIC?", a: ["14", "45", "55"], c: 1 },
            { q: "Which department is led by Dr. Rickelodeon Velveetus?", a: ["Alignment", "pSEC", "Brigistics"], c: 1 },
            { q: "Where does Rickelodeon Velveetus keep all the PRIC login passwords?", a: ["On a secure server", "In a holographic vault", "On one napkin in his desk"], c: 2 },
            { q: "What is the time-travel method used to go to the future?", a: ["The Wormhole method", "The Pinch method", "The Slingshot method"], c: 1 },
            { q: "What is the time-travel method used to go to the past?", a: ["The Wormhole method", "The Pinch method", "The Loop method"], c: 0 },
            { q: "What is the Bit Depth of the audio passed across time before reconstruction?", a: ["16 bits", "8 Qbits", "4 D-bits"], c: 1 },
            { q: "Which AI productivity bot was put in sleep mode after creating 'diarrhea poison'?", a: ["Crummy13", "Tyler", "Olivia"], c: 1 },
            { q: "Who is the only person working in the Alignment department?", a: ["Dandelion Whoelf Ouedes", "Swartz Plander", "Gillian Shea"], c: 0 },
            { q: "Which department developed teleporters that 'don't quite work'?", a: ["Brigistics", "R&D&R&P", "Galileo Deployment"], c: 1 },
            { q: "What was Jimley Huffman’s genetics passion project before he discovered Sprot™?", a: ["Moon Potatoes", "Turbacco", "Synthetic Geese"], c: 1 },
            { q: "What is the name of the cryptocurrency created by Crummy13?", a: ["PodCoin", "Crum Coin", "Q-Bit Cash"], c: 1 },
            { q: "How many keycards are required to open the massive door to the pSEC department?", a: ["Two", "Three", "Five"], c: 1 },
            { q: "What is the nickname for the system used to open the pSEC door?", a: ["The Master Key", "The Triple Lock", "The Buddy-Buddy-Buddy System"], c: 2 },
            { q: "Who is the 'Colonel' in charge of time travel compliance?", a: ["Stove", "Prabo", "Dick Blakely"], c: 2 },
            { q: "What does the 'Todd' in 'Todd Talks' stand for?", a: ["Talking, Observing, and Discussing", "Temporal Observations and Digital Data", "Technological Outreach and Discovery"], c: 0 },
            { q: "Which streaming network broadcasts Todd Talks from the PRIC?", a: ["Netflix", "Twibbie On Demand", "YouTube"], c: 1 },
            { q: "What is the name of the medical drama airing on Twibbie?", a: ["Hospital Drama", "Monochrome's Analysis", "The Doctor Is In"], c: 1 },
            { q: "What is the name of the mobster show on Twibbie?", a: ["The Chosen Older Relative", "The Meatball Family", "Spaghetti Babies"], c: 0 },
            { q: "What is the name of the heist movie about stealing Mark Zuckerberg's baby teeth?", a: ["The Great Con", "Large Water Number", "Zucker up, Buttercup"], c: 1 },
            { q: "In the 'Wormhole' method, how far apart are the two time loops placed?", a: ["One second", "One millisecond", "One billionth of a millisecond"], c: 2 },
            { q: "What is the name of the 'forgettable' drones used for PodCube™ delivery?", a: ["Beta Drones", "Galileo Drones", "PRIC Drones"], c: 1 },
            { q: "What is the maximum travel endurance of a Galileo Drone?", a: ["1 million years", "2 Quattuordecillion years", "Infinite years"], c: 1 },
            { q: "Which department is responsible for the internal 'Buddy-Buddy-Buddy' security protocol?", a: ["Alignment", "Outreach", "pSEC"], c: 2 },
            { q: "Who is the talkative employee responsible for managing PodChat?", a: ["Prabo", "Stove", "Swartz Plander"], c: 2 }
        ];

        this.questions = this.allQuestions
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        this.QUESTION_TIME = 10;

    }



    onInit() {
        this.score = 0;
        this.qIndex = 0;
        this.correctCount = 0;

        this.api.setScore(0);
        this.api.setStatus('ACTIVE');
        this.showQuestion();
    }

    showQuestion() {
        const q = this.questions[this.qIndex];

        // Reset Timer
        this.timeLeft = this.QUESTION_TIME;

        this.api.UI.build([
            { type: 'title', text: `Question ${this.qIndex + 1} / ${this.questions.length}` },
            // Timer Bar
            { type: 'progress', id: 'timer', value: 1, color: '#22c55e' },
            { type: 'spacer', size: 10 },
            { type: 'text', text: q.q, style: { fontSize: '18px', fontWeight: 'bold' } },
            { type: 'spacer', size: 20 },
            {
                type: 'grid', cols: 1, gap: 10,
                children: q.a.map((ans, i) => ({
                    type: 'button',
                    text: ans,
                    onClick: () => this.handleAnswer(i === q.c)
                }))
            }
        ]);
    }

    update(dt) {
        // Decrease timer
        if (this.timeLeft > 0) {
            this.timeLeft -= dt;

            // Visual Update: Find the bar by ID and set width
            const bar = document.getElementById('timer-bar');
            if (bar) {
                const pct = Math.max(0, this.timeLeft / this.QUESTION_TIME);
                bar.style.width = `${pct * 100}%`;
                // Turn red if low on time
                if (pct < 0.3) bar.style.backgroundColor = '#ef4444';
            }

            // Timeout Logic
            if (this.timeLeft <= 0) {
                this.handleAnswer(false); // Count as wrong
            }
        }
    }

    handleAnswer(isCorrect) {
        // 1. Initialize a correct counter if it doesn't exist
        this.correctCount = this.correctCount || 0;

        if (isCorrect) {
            this.correctCount++; // Increment the successful answer count
            const bonus = Math.floor(this.timeLeft * 10);
            this.score += 100 + bonus;
            this.api.setScore(this.score);
        }

        this.qIndex++;

        if (this.qIndex >= this.questions.length) {
            // 2. Determine the variety message based on performance
            let performanceMsg = "";
            const accuracy = this.correctCount;

            if (accuracy === 10) performanceMsg = "Perfect actualization! Jimley and Dick are impressed.";
            else if (accuracy >= 7) performanceMsg = "Solid PRIC knowledge. You might be promoted to pSEC.";
            else if (accuracy >= 4) performanceMsg = "Acceptable performance. Drink more Sprot™.";
            else performanceMsg = "Temporal failure. Reporting to Alignment department.";

            // 3. Show the final tally (e.g., "7 / 10 CORRECT")
            const finalResults = `${accuracy} / ${this.questions.length} CORRECT | SCORE: ${this.score}`;

            // Use win() for high scores, or you could use gameOver() for failures
            this.api.win(`${performanceMsg}\n${finalResults}`);
        } else {
            this.showQuestion();
        }
    }

    draw(gfx) { gfx.clear('#f4f4f4'); }
}

Interactive.register('quiz', QuizGame);