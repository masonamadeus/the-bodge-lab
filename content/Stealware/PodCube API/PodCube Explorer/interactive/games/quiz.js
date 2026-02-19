// =============================================================================
// QUIZ - Timed Trivia
// =============================================================================

class QuizGame extends Game {

    static meta = {
        id: 'quiz',
        title: "PodCube™ Trivia",
        desc: "Answer as many questions as you can about PodCube™. 15 seconds per question, no incorrect answers allowed. Randomized each time.",
        instructions: "Select the correct answer before time runs out.\nThe test will end when you have selected an incorrect response.\nEach test is randomized."
    };

    constructor(api) {
        super(api);


        this.allQuestions = [
            { q: "Who are the two founders of PodCube™?", a: ["Jimley Huffman and Dick Blakely", "Prabot and Stove", "Sal Solitaro and Rolo Dilby"], c: 0 },
            { q: "In what year did the founders first envision the time sphere for their 8th-grade science fairs?", a: ["2048", "2027", "2046"], c: 1 },
            { q: "What is the full name of the PodCube™ headquarters?", a: ["The PodCube™ Center", "PodCube™ Research and Innovation Campus (PRIC)", "The Huffman Rotunda"], c: 1 },
            { q: "Where is the PRIC located?", a: ["A skyscraper in New York", "An artificial island off the coast of Miami", "Underground in Kentucky"], c: 1 },
            { q: "What powers the entire PRIC campus?", a: ["Nuclear fusion", "Solar panels and wind", "Alligator movement"], c: 2 },
            { q: "As of the year 2100, how many alligators are part of the PodCube™ conservation program?", a: ["10,000", "45,000", "100,000"], c: 1 },
            { q: "What are the names of the four groups of alligators at the PRIC?", a: ["Small, Medium, Big, and Huge", "Rachel, Tyler, Bradley, and Carol", "Alpha, Beta, Gamma, and Delta"], c: 1 },
            { q: "What is the official fermented beverage of the PRIC?", a: ["Sprot™", "PodFluid", "Chardondas Wine"], c: 0 },
            { q: "How many vitamins and minerals are packed into a single can of Sprot™?", a: ["550+", "More than 5,500", "Over 55,000"], c: 2 },
            { q: "What is the name of the eleven-dimensional model of the universe discovered by the founders?", a: ["The Adiabatic Tesseract", "The Blakely-Huffman Spheroid", "The ISWORM"], c: 1 },
            { q: "What term describes a point where an infinite amount of possible futures share identical probability distributions?", a: ["Temporal Junction", "Actualization Anomaly", "Inevitability Moment"], c: 1 },
            { q: "What is the 'ISWORM' otherwise known as?", a: ["The Literal Occurrence Graph (LOG) log log", "Terror of the Sun", "The Defrigulator"], c: 0 },
            { q: "What is the shape of the 'tesseract of existence' according to internal notes?", a: ["A cube", "A sphere", "A turd"], c: 2 },
            { q: "Which department is responsible for receiving and processing transmissions from deployed PodCube™s?", a: ["Galileo Deployment", "Brigistics", "R&D+R&P"], c: 1 },
            { q: "What is the name of the internal instant messaging service at PodCube™?", a: ["PodMail", "PodChat", "PRIC-Link"], c: 1 },
            { q: "Who holds the title of Corporate Cool Officer (CCO)?", a: ["Stove", "Prabo", "Swartz Plander"], c: 1 },
            { q: "What is Stove's official title at PodCube™?", a: ["CEO", "Cool Community Outreach Person (CCOP)", "Head of Alignment"], c: 1 },
            { q: "Which department is responsible for the Galileo Drone Deployment system?", a: ["F.L.U.R.C.H.", "Galileo Drone Deployment", "Customer Relations"], c: 1 },
            { q: "What is the name of the AI that provides outros for many PodCube™ transmissions?", a: ["01iv.ia", "Pooty-95", "Crummy13"], c: 2 },
            { q: "What does the number '13' in Crummy13 represent?", a: ["Their creation date", "The operating system they are running", "Their rank in the AI department"], c: 1 },
            { q: "Which piece of landmark legislation is Dick Blakely responsible for?", a: ["The B.O.N.K. Decree", "Mandatory Undualtion Disclosure", "Temporal Untidiness Redress Directive"], c: 2 },
            { q: "What is the name of the outdoor recreational path for employees at the PRIC?", a: ["The Nature Loop", "Ravioli Walkabout", "The Jimley Huffman Rotunda"], c: 1 },
            { q: "What experimental pineal implant auto-plays PodCube™ transmissions for the user?", a: ["BHS-Link", "HORUS", "PodCortex™"], c: 1 },
            { q: "How long does a PodCube™ device become useless if the 'back flap' is tampered with?", a: ["4 years", "6 months", "Forever"], c: 0 },
            { q: "What is the name of the fuel cell used in Galileo Drones?", a: ["CoreN (Corn Core)", "Q-Bit Cell", "Adiabatic Battery"], c: 0 },
            { q: "How many staff bathrooms are located throughout the PRIC?", a: ["14", "45", "120"], c: 1 },
            { q: "Which department is led by Dr. Rickelodeon Velveetus?", a: ["Alignment", "pSEC", "Brigistics"], c: 1 },
            { q: "Where does Rickelodeon Velveetus keep all the PRIC login passwords?", a: ["On a secure server", "In a holographic vault", "On one napkin in his desk"], c: 2 },
            { q: "What is the time-travel method used to go to the future?", a: ["The Wormhole method", "The Pinch method", "The Slingshot method"], c: 1 },
            { q: "What is the time-travel method used to go to the past?", a: ["The Wormhole method", "The Pinch method", "The Loop method"], c: 0 },
            { q: "What is the Bit Depth of the audio passed across time before reconstruction?", a: ["16 bits", "8 q-bits", "4 D-bits"], c: 1 },
            { q: "Which AI productivity bot was put in sleep mode after creating 'diarrhea poison'?", a: ["Crummy13", "Tyler", "Jay6"], c: 1 },
            { q: "Who is the only person working in the Alignment department?", a: ["Dandelion Whoelf Ouedes", "Swartz Plander", "Gillian Shea"], c: 0 },
            { q: "Which department developed teleporters that 'don't quite work'?", a: ["Brigistics", "R&D&R&P", "F.L.U.R.C.H."], c: 1 },
            { q: "What was Jimley Huffman’s genetics passion project before he discovered Sprot™?", a: ["Moon Potatoes", "Turbacco", "Synthetic Geese"], c: 1 },
            { q: "What is the name of the cryptocurrency created by Crummy13?", a: ["PodCoin", "Crum Coin", "Q-bitcoin"], c: 1 },
            { q: "How many keycards are required to open the massive door to the pSEC department?", a: ["Two", "Three", "Five"], c: 1 },
            { q: "What is the nickname for the system used to open the pSEC door?", a: ["Count Up to Eight", "The Gauntlet", "The Buddy-Buddy-Buddy System"], c: 2 },
            { q: "Who is the 'Colonel' in charge of time travel compliance?", a: ["Detective Monadnock", "Crummy13", "Dick Blakely"], c: 2 },
            { q: "What does the 'Todd' in 'Todd Talks' stand for?", a: ["Talking, Observing, and Discussing", "Temporal Observations and Digital Data", "Technological Outreach and Discovery"], c: 0 },
            { q: "Which streaming network broadcasts Todd Talks from the PRIC?", a: ["Netflix", "Twibbie On Demand", "Wexton Industries"], c: 1 },
            { q: "What is the name of the medical drama airing on Twibbie?", a: ["Hospital Drama", "Monochrome's Analysis", "The Doctor Is In"], c: 1 },
            { q: "What is the name of the mobster show on Twibbie?", a: ["The Chosen Older Relative", "The Meatball Family", "Spaghetti-Slurping Sleepover Babies"], c: 0 },
            { q: "What is the name of the heist movie about stealing Mark Zuckerberg's baby teeth?", a: ["The World's Greatest Con", "Large Water Number", "Zucker up, Buttercup"], c: 1 },
            { q: "In the 'Wormhole' method, how far apart are the two time loops placed?", a: ["One second", "One millisecond", "One billionth of a millisecond"], c: 2 },
            { q: "What is the name of the 'forgettable' drones used for PodCube™ delivery?", a: ["Beta Drones", "Galileo Drones", "PRIC Drones"], c: 1 },
            { q: "What is the maximum travel endurance of a Galileo Drone?", a: ["1 million years", "2 Quattuordecillion years", "Infinite years"], c: 1 },
            { q: "Which department is responsible for the internal 'Buddy-Buddy-Buddy' security protocol?", a: ["Alignment", "Outreach", "pSEC"], c: 2 },
            { q: "Who is the talkative employee responsible for managing PodChat?", a: ["Prabo", "Stove", "Swartz"], c: 2 },
            { q: "What is the slogan of the Tall Building Design company?", a: ["Build high, touch the sky", "Tall, no fall", "Stability through height"], c: 1 },
            { q: "Which Slow Taco menu item consists of soft shell, scrambled eggs, and 'who cares?' salsa?", a: ["The Lazy Daisy", "The Slow Roll", "The Morning Mozey"], c: 0 },
            { q: "What is 'Taco Water' at Slow Taco?", a: ["Watered-down hot sauce", "Lightly seasoned water in a branded cup", "Very thin melted nacho cheese"], c: 1 },
            { q: "At Dusty’s Burger Trough, kids eat for free under what condition?", a: ["If they catch the tractor", "If they finish the Moo Moo Melt", "If they can name all the cows"], c: 0 },
            { q: "The 'ISWORM' is technically defined as what?", a: ["The Spacetime Analyzer", "The path taken by an individual reference frame moving through time", "The core of a Galileo Drone"], c: 1 },
            { q: "Which procurement company deals in rare fruit, vegetables, and extremely rare insects?", a: ["SQUIRT", "Sprot Corp", "Wexton Logistics"], c: 0 },
            { q: "Traveling forward in time for 25 years requires how long of a wait?", a: ["25 minutes", "25 years", "25 milliseconds"], c: 1 },
            { q: "An employee at the PRIC is notorious for drawing what in the bathrooms?", a: ["A tesseract shaped like a turd", "A butt with long legs and big muscle arms", "Jimley Huffman's face"], c: 1 },
            { q: "How many full-time Gator Employees monitor the alligators at the PRIC movement room?", a: ["Two", "Four", "Ten"], c: 1 },
            { q: "Who is the PRIC agent responsible for monitoring email correspondence in the year 2160?", a: ["Gillian Shea", "Gerry Solitaro", "Swartz Plander"], c: 0 },
            { q: "Which hospital is the origin for many transmissions involving 'Mr. Hardhands' and 'Cosmic Ron'?", a: ["Victoria P. Coopergram Memorial Hospital", "St. Augustine Medical Center", "Wexton General"], c: 0 },
            { q: "In the Wexton Industries HR interview, Jamison claims to have a dog of what breed?", a: ["Golden Retriever", "Labrador Retriever", "Greyhound"], c: 1 },
            { q: "What is the name of the D&D character who wears a 'tunic of green leaf' for a charisma bonus?", a: ["Grefton", "Sneetch", "Argyle"], c: 0 },
            { q: "In the elevator crisis at Lease on Life Apartments, what item is suggested as a solution for the trapped victim?", a: ["A ladder", "A futon", "A rope"], c: 1 },
            { q: "In the movie 'Large Water Number,' what body part are the thieves stealing from Mark Zuckerberg?", a: ["Fingerprints", "Baby teeth", "Toenail clippings"], c: 1 },
            { q: "What is the secret ingredient for the 'Tiramisu Tuesday' finale on the show 'Cookin'?", a: ["Hazelnuts and sour cream", "Mustard and a beet", "Hot glue and lead"], c: 1 },
            { q: "Where does the 'Cook-IN' contestant Naples Florida grow up?", a: ["Naples, Florida", "Des Moines, Iowa", "Chelsea, New York"], c: 1 },
            { q: "What promo code provides six months of free Twibbie Max Prime?", a: ["PODCUBE360", "HYPERSMOOTH", "GLEEPGLORP"], c: 1 },
            { q: "The sci-fi writer Jeff claims to have been the head writer for which major film?", a: ["The Matrix 6", "Shrek 5", "Dune 4"], c: 1 },
            { q: "What is the name of the 'scary' villain that causes a rift between writers Roger and Jeff?", a: ["The Unbidden Ember", "Admiral Gleepglorp", "The Is-Worm"], c: 1 },
            { q: "What planet is the origin for the KitFox War Machine cockpit recording?", a: ["Jauboris IV", "Vandross 5", "Mars 2"], c: 0 },
            { q: "The mech 'Blood Murder Falcon' is warned that its system is alerting it in which language?", a: ["English", "Spanish", "Binary"], c: 1 },
            { q: "What is the name of the robot who attempts to borrow money while drinking IPAs with Mason?", a: ["Jay6 Richards", "Crummy13", "Tyler"], c: 0 },
            { q: "A florist in East Longmeadow hates flowers so much he compares himself to what?", a: ["A garbage man", "A poop seller", "A funeral director"], c: 1 },
            { q: "Which employee won the 'Quality of Life Enrichment' award for memorizing all of Chandler's lines from Friends?", a: ["Pemberley Laudern", "Gillian Shea", "Dandelion Whole Foods"], c: 0 },
            { q: "In the game 'Seneschal of Scion,' teabagging a dead rabbit six times causes what?", a: ["A hidden boss to appear", "The game to crash", "A charisma boost"], c: 1 },
            { q: "The ISS pilot cosmonaut Stacey Jackson claims to have ridden what to outer space?", a: ["A PodCube Drone", "A rocket", "The BHS Spheroid"], c: 1 },
            { q: "What is the name of the cow-based game show that requires 'canned' audience gasps?", a: ["Milwaukee Moo", "The Cow Crush", "A Milwaukee Game Show"], c: 2 },
            { q: "In the band rehearsal for 'Can't Feel My Feelings,' what section of the store does the drummer work in?", a: ["Meat", "Produce", "Electronics"], c: 1 },
            { q: "The LRM (Little Rubber Men) division noticed that customer surveys were being returned in what format?", a: ["Binary", "Morse Code", "Syllabic vocal cadence"], c: 0 },
            { q: "What did Clark find stuck 'back in the behind' of his computer fan?", a: ["A french fry", "An onion ring", "A chicken nugget"], c: 1 },
            { q: "Finley, the synthetic goose manufacturer, quits his job to work at what kind of factory?", a: ["Peacock", "Penguin", "Duck"], c: 0 },
            { q: "What movie theme was used for a 2004 wedding at Martha's Vineyard?", a: ["Star Wars", "The Matrix", "Dune"], c: 1 },
            { q: "At the 1803 pub in Leeds, what 'pastry' does Ronald Binsley sell?", a: ["Butt pies", "Foot pasties", "Croissants"], c: 1 },
            { q: "What is the name of the 'last vape' flavor intended for the deathbed?", a: ["Baked Beans", "Formaldehyde", "Martian Ale"], c: 1 },
            { q: "What is the 'Drip House' in New York City?", a: ["A dry coffee shop", "A luxurious bathroom reservation establishment", "A fashion boutique for geese"], c: 1 },
            { q: "What is the 'Sprot Minimum' beverage?", a: ["Sprot for kids", "Sprot with only 11,000 minerals", "Clear Sprot"], c: 1 },
            { q: "What is the name of the 'newest sommelier' who can hear things in wine?", a: ["Cosmic Ron", "The Drano Guy", "Matilde"], c: 1 },
            { q: "Which PodCube™ employee gives instructions on implementing a security patch involving rubber bands?", a: ["Dr. Rickelodeon Velveetus", "Jimley Huffman", "Swartz Plander"], c: 0 },
            { q: "What is the name of the 'vampire hunter' who accepts tea from a count on Prince Edward Island?", a: ["Damien Van Helsing", "Jacob", "Jack Higgins"], c: 0 },
            { q: "Which store sells ceramic bears and figurines through a complex pneumatic system?", a: ["Tubes", "Purple Culeus", "SupaDupam"], c: 0 },
            { q: "What iconic American single is debated during a fight at a combination Denny's and Blockbuster?", a: ["All I Want for Christmas Is You", "Stayin' Alive", "Single Ladies"], c: 0 },
            { q: "What unusual body modification does Dave install to make his voice louder?", a: ["A pineal implant", "Throat subwoofers", "A bionic jaw"], c: 1 },
            { q: "Crummy13 compares talking to humans to a conversation with what object?", a: ["A poop shovel", "A sentient meatball", "A questionably sentient meatball"], c: 2 },
            { q: "In the Receiving Chamber, what is Maintenance Protocol 726 designed to do?", a: ["Initiate self-destruct", "Set the defregulator in suspension", "Activate the ISWORM"], c: 1 },
            { q: "What happened to the technicians when they fixed the isworm loop?", a: ["They were fired", "They became smaller", "They turned into alligators"], c: 1 },
            { q: "What are the core ingredients used in the creation of 'diarrhea poison'?", a: ["Cadmium, mercury, and Red 40", "Diamonds, emeralds, and rare crystals", "Corn syrup, lemon, and ink"], c: 1 },
            { q: "According to the heist crew, what does Zuckerberg's baby mouth smell like?", a: ["Money wrapped in meat", "Sweet Hawaiian barbecue sauce", "Lavender paper"], c: 1 },
            { q: "What was the name of Crummy13's human boyfriend whom he broke up with in 5086?", a: ["Martin", "Regis", "Jeffrey"], c: 0 },
            { q: "What is the main event of 'Circle Day' in the year 4220?", a: ["A time travel demo", "Watching Ryan eat his poop", "A chanting ritual"], c: 1 },
            { q: "How are Dave's throat subwoofers powered?", a: ["AAAA Batteries", "Brain activity", "Blood flow"], c: 2 },
            { q: "What does the 'p' in 'pSEC' stand for?", a: ["Private", "Pseudolinear", "PodCube"], c: 1 },
            { q: "What is the name of Rolo Dilby's restaurant in Chelsea, New York?", a: ["Sandia", "Slow Taco", "Rolo’s Roast"], c: 0 },
            { q: "Ronald Binsley is planning to build a boat out of what material?", a: ["Human bones", "PodCube polymers", "Driftwood"], c: 0 },
            { q: "What does 'LRM' stand for in Wexton Industries marketing meetings?", a: ["Little Rubber Men", "Large Robot Machines", "Linear Reference Models"], c: 0 },
            { q: "On the show 'Monochrome's Analysis,' what condition does the second patient have?", a: ["A broken heart", "A second leg", "Paperwork fever"], c: 1 },
            { q: "What does Salvador Solitaro call himself on his food travel show?", a: ["The Spicy Cat", "The Saucy Dog", "The Hot Jalapeño"], c: 1 },
            { q: "What does Admiral Gleepglorp do that goes against his society's values?", a: ["Eats people", "Drinks blood", "Uses regular money"], c: 1 },
            { q: "A lost man in a park is terrified of hitting his nose on what?", a: ["The pet store door", "Machine gun fire", "Bowls in his cat's backpack"], c: 2 },
            { q: "P-Mobile Bodytorium offers Washington what upgrade?", a: ["Bionic legs", "Left kidney and heart", "Pancreas and spleen"], c: 2 },
            { q: "What does Dusty's Burger Trough call their shake with cookie crunch?", a: ["Barnyard Blast", "Double Wrench", "Cow pie"], c: 2 },
            { q: "PodCube devices are constructed using a special rapidly drying liquid agent called what?", a: ["Adiabatic gel", "Cyanoacrylate", "Q-Bit resin"], c: 1 },
            { q: "What brand of cupcakes is available as a snack on the PodCube campus?", a: ["Jimley's Prodigy Pies", "Tom Birthday’s Every Day Cupcakes", "Dusty’s Mud Pie Minis"], c: 1 },
        ];

        this.QUESTION_TIME = 15;

    }



    onInit() {
        this.score = 0;
        this.qIndex = 0;
        
        this.questions = [...this.allQuestions].sort(()=> Math.random() - 0.5);

        this.api.setScore(0);
        this.api.setStatus('ACTIVE');
        this.showQuestion();
    }

    showQuestion() {
        // Grab a question
        const q = this.questions[this.qIndex];

        // Reset Timer
        this.timeLeft = this.QUESTION_TIME;

        // Shuffle answer positions
        const indices = q.a.map((_, i) => i).sort(() => Math.random() - 0.5);


        this.api.UI.build([
            { type: 'title', text: `Question ${this.qIndex + 1}` },
            // Timer Bar
            { type: 'progress', id: 'timer', value: 1, color: '#22c55e' },
            { type: 'spacer', size: 10 },
            { type: 'text', text: q.q, style: { fontSize: '14px', fontWeight: 'bold' } },
            { type: 'spacer', size: 20 },
            {
                type: 'grid', cols: 1, gap: 10,
                // Map over the SHUFFLED indices to generate buttons
                children: indices.map((originalIndex) => ({
                    type: 'button',
                    text: q.a[originalIndex],
                    // We pass the event 'e' to the handler
                    onClick: (e) => this.handleAnswer(e, originalIndex === q.c)
                }))
            }
        ]);
    }

    update(dt) {
        // Decrease timer
        if (this.timeLeft > 0) {
            this.timeLeft -= dt;

            if (this.processing) { return; }

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

    handleAnswer(e, isCorrect) {
        // Prevent double clicks
        if (this.processing) return;
        this.processing = true;

        // Visual Feedback
        if (e && e.target) {
            const btn = e.target;
            // Immediate style change
            btn.style.backgroundColor = isCorrect ? '#22c55e' : '#ef4444';
            btn.style.borderColor = isCorrect ? '#15803d' : '#b91c1c';
            btn.style.color = 'white';
        }

        // Delay logic by 800ms
        setTimeout(() => {
            this.processing = false;

            if (isCorrect) {
                // Correct: Add score and continue
                const bonus = Math.floor(this.timeLeft * 100);
                this.score += 1000 + bonus;
                this.api.setScore(this.score);
                
                this.qIndex++;
                if (this.qIndex >= this.questions.length) {
                    this.api.win(`YOU MUST HAVE CHEATED. PERFECT RUN.\nFINAL SCORE: ${this.score}`);
                } else {
                    this.showQuestion();
                }
            } else {
                // Incorrect: Sudden Death
                const best = this.api.getHighScore();
                const msg = isCorrect ? "" : "INCORRECT ANSWER DETECTED.";
                this.api.gameOver(`${msg}\nQuestions Answered: ${this.qIndex}\nFinal Score: ${this.score}\nBest Score: ${best}`);
            }
        }, 800);
    }

    draw(gfx) { gfx.clear('#f4f4f4'); }
}

Interactive.register(QuizGame);