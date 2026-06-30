// =============================================================================
// CARTRIDGE: Knowledge Protocol (Trivia Quiz)
//
// Demonstrates: multi-scene pattern, DOM UI builder, stateful game logic
//
// State machine:
//   'question'  →  player sees question + 4 answers + countdown timer
//   'feedback'  →  player sees result (correct/wrong) + next button
//   then scene switches to 'results' after the last question
//
// All state lives in closure variables shared across both scenes.
// =============================================================================
/*
Interactive.register('quiz', (() => {

  // ── Question bank ─────────────────────────────────────────────────────────
  // To add questions: { cat, q, a: string[4], c: index of correct answer }
  const BANK = [
    { cat:'TECH', q:"What does CSS stand for?",                    c:0, a:["Cascading Style Sheets","Computer Style Syntax","Coded Style Scripts","Creative Sheet System"] },
    { cat:'TECH', q:"Which data structure uses LIFO order?",       c:2, a:["Queue","Linked List","Stack","Tree"] },
    { cat:'TECH', q:"What does HTTP stand for?",                   c:0, a:["HyperText Transfer Protocol","High-Throughput Text Protocol","Hyperlink Text Transport","HyperText Template Protocol"] },
    { cat:'TECH', q:"Which language runs natively in browsers?",   c:3, a:["Python","Ruby","Java","JavaScript"] },
    { cat:'MATH', q:"What is 2 to the power of 10?",              c:3, a:["512","2048","256","1024"] },
    { cat:'MATH', q:"What is the square root of 144?",            c:1, a:["11","12","13","14"] },
    { cat:'MATH', q:"How many sides does a dodecagon have?",       c:2, a:["10","11","12","13"] },
    { cat:'MATH', q:"What is π to 4 decimal places?",             c:0, a:["3.1416","3.1415","3.1417","3.1419"] },
    { cat:'SCI',  q:"Which planet is closest to the Sun?",         c:2, a:["Venus","Earth","Mercury","Mars"] },
    { cat:'SCI',  q:"What is the chemical symbol for gold?",       c:3, a:["Go","Gd","Gl","Au"] },
    { cat:'SCI',  q:"Approximate speed of light?",                 c:0, a:["300,000 km/s","150,000 km/s","600,000 km/s","30,000 km/s"] },
    { cat:'SCI',  q:"How many bones in the adult human body?",     c:1, a:["186","206","226","246"] },
  ];

  const QUESTION_TIME = 15; // seconds per question
  const QUESTION_COUNT = 8; // how many to draw from the bank each game

  // ── Shared closure state ──────────────────────────────────────────────────
  // These are written by `play.enter` (reset) and read by both scenes.
  let questions  = [];  // shuffled subset of BANK for this run
  let qi         = 0;   // current question index (0-based)
  let totalScore = 0;
  let answers    = [];  // { correct: bool, gained: number, q: string, right: string }

  // Per-question state — reset each time a new question is shown
  let phase     = 'question'; // 'question' | 'feedback'
  let timeLeft  = QUESTION_TIME;
  let shuffled  = [];   // shuffled answer options for current question


  // ── Helpers ───────────────────────────────────────────────────────────────

  function startGame() {
    questions  = [...BANK].sort(() => Math.random() - 0.5).slice(0, QUESTION_COUNT);
    qi         = 0;
    totalScore = 0;
    answers    = [];
  }

  function loadQuestion(api) {
    const q   = questions[qi];
    phase     = 'question';
    timeLeft  = QUESTION_TIME;

    // Shuffle the 4 options while tracking which one is correct
    shuffled = [0, 1, 2, 3]
      .sort(() => Math.random() - 0.5)
      .map(i => ({ text: q.a[i], correct: i === q.c }));

    api.setLabel(`Q ${qi + 1} / ${questions.length}`);
    renderQuestion(api);
  }

  function renderQuestion(api) {
    const q = questions[qi];
    api.ui.build([
      // Row: category  /  question number
      {
        type: 'grid', cols: 2,
        style: { alignItems: 'center' },
        children: [
          { type:'text', text: `● ${q.cat}`, style:{ fontSize:'10px', color:'#aaa', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em' } },
          { type:'text', text: `${qi+1} of ${questions.length}`, style:{ fontSize:'10px', color:'#aaa', fontWeight:'700', textAlign:'right' } },
        ]
      },
      // Timer bar (drained in update)
      { type:'progress', id:'quiz-timer', value: 1 },

      // Question text
      { type:'title', text: q.q, style:{ fontSize:'14px', textTransform:'none', lineHeight:'1.4', marginTop:'4px' } },

      // 2×2 answer grid
      {
        type: 'grid', cols: 2, gap: 6,
        children: shuffled.map((opt, i) => ({
          type: 'button',
          text: opt.text,
          id:   `quiz-opt-${i}`,
          style:{ width:'100%', fontSize:'11px', padding:'10px 6px', lineHeight:'1.3', textTransform:'none' },
          onClick: () => submitAnswer(opt.correct, api),
        })),
      },
    ]);
  }

  function submitAnswer(correct, api) {
    // Guard: ignore if already answered (prevents double-clicks and timer racing a click)
    if (phase !== 'question') return;
    phase = 'feedback';

    const q         = questions[qi];
    const timeBonus = correct ? Math.round((timeLeft / QUESTION_TIME) * 10) : 0;
    const gained    = correct ? 10 + timeBonus : 0;
    totalScore += gained;

    if (correct) api.setScore(totalScore);

    answers.push({ correct, gained, q: q.q, right: q.a[q.c] });

    renderFeedback(correct, gained, timeBonus, q.a[q.c], api);
  }

  function renderFeedback(correct, gained, timeBonus, rightAnswer, api) {
    const isLast  = qi >= questions.length - 1;
    const col     = correct ? '#22c55e' : '#ef4444';
    const label   = correct ? '✓ CORRECT' : '✗ INCORRECT';
    const subline = correct
      ? `+${gained} pts${timeBonus > 0 ? `  (incl. +${timeBonus} speed bonus)` : ''}`
      : `Answer: ${rightAnswer}`;

    api.ui.build([
      { type:'spacer', size:16 },
      { type:'title', text: label, style:{ color: col, fontSize:'20px' } },
      { type:'text',  text: subline, style:{ fontSize:'12px' } },
      { type:'spacer', size:12 },
      {
        type: 'button', primary: true,
        text: isLast ? 'SEE RESULTS →' : 'NEXT QUESTION →',
        onClick: () => {
          if (isLast) {
            api.scene('results');
          } else {
            qi++;
            loadQuestion(api);
          }
        },
      },
    ]);
  }


  // ── Cartridge ─────────────────────────────────────────────────────────────
  return {
    meta: {
      title:        "Knowledge Protocol",
      desc:         "Answer trivia questions under time pressure. Speed bonuses apply.",
      instructions: "Select the correct answer before the 15-second timer runs out.",
      controls:     "CLICK or TAP an answer",
    },

    startScene: 'play',

    scenes: {

      // ── Play scene ─────────────────────────────────────────────────────────
      play: {
        enter(api) {
          startGame();
          api.setScore(0);
          api.setStatus('RUNNING');
          loadQuestion(api);
        },

        update(dt, _input, api) {
          // Only the countdown matters during 'question' phase
          if (phase !== 'question') return;

          timeLeft -= dt;

          // Update the timer bar width
          const bar = api.ui.get('quiz-timer');
          if (bar) bar.style.width = `${Math.max(0, timeLeft / QUESTION_TIME) * 100}%`;

          // Time's up — count it as wrong
          if (timeLeft <= 0) submitAnswer(false, api);
        },

        // This is a DOM game — just paint a neutral background behind the UI
        draw(gfx) { gfx.clear('#fdfdfc'); },
      },

      // ── Results scene ──────────────────────────────────────────────────────
      results: {
        enter(api) {
          const numCorrect = answers.filter(a => a.correct).length;
          const total      = answers.length;
          const pct        = Math.round((numCorrect / total) * 100);
          const rating     = pct >= 80 ? 'OPTIMAL' : pct >= 60 ? 'ADEQUATE' : pct >= 40 ? 'MARGINAL' : 'FAILING';
          const ratingCol  = pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';

          api.setStatus(rating);
          api.setLabel('');

          api.ui.build([
            { type:'title', text:'ASSESSMENT COMPLETE' },
            { type:'divider' },
            { type:'text',  text:`${numCorrect} / ${total} correct  ·  ${totalScore} pts`, style:{ fontWeight:'700', fontSize:'13px', color:'#333' } },
            { type:'text',  text:`RATING: ${rating}`,                                       style:{ fontWeight:'700', color:ratingCol, fontSize:'13px' } },
            { type:'text',  text:`HIGH SCORE: ${api.getHighScore()} pts`,                   style:{ color:'#999', fontSize:'11px' } },
            { type:'spacer', size:4 },

            // Per-question result breakdown
            ...answers.map(a => ({
              type: 'html',
              html: `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #eee;font-family:Fustat;font-size:10px;color:#555;">
                  <span style="font-weight:700;color:${a.correct ? '#22c55e' : '#ef4444'};flex-shrink:0;">${a.correct ? '✓' : '✗'}</span>
                  <span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${a.q}</span>
                  ${a.correct ? `<span style="color:#888;font-size:9px;white-space:nowrap;">+${a.gained}</span>` : `<span style="color:#888;font-size:9px;white-space:nowrap;">${a.right}</span>`}
                </div>`,
            })),

            { type:'spacer', size:8 },
            { type:'button', text:'RETRY ASSESSMENT', primary:true, onClick:() => api.scene('play') },
          ]);
        },

        update() { // results screen is static },
        draw(gfx)  { gfx.clear('#fdfdfc'); },
      },
    },
  };

})());
//*/