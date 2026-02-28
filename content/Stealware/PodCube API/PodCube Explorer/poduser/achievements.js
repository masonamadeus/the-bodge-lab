/**
 * achievements.js — PodCube Achievement Definitions
 *
 * Generated via PodCube Achievement Builder IDE
 */

window.addEventListener('PodCube:Ready', () => {

    PodUser.registerAchievement({
        id: 'first_transmission',
        title: 'Auditory Compliance',
        desc: 'Listened to your first PodCube Transmission.',
        icon: '📡',
        condition: (data) => {
        return data.history.length >= 1;
    },
        reward: {
            type: 'image',
            url: './poduser/assets/Time%20Eggnogstic.png',
            caption: 'Thank you for choosing, or having already chosen, podcube™',
        },
    });

    PodUser.registerAchievement({
        id: 'seasoned_listener',
        title: 'Signal Absorption Confirmed',
        desc: 'Listened to 10 transmissions.',
        icon: '🎧',
        condition: (data) => data.history.length >= 10,
    });

    PodUser.registerAchievement({
        id: 'lore_hunter',
        title: 'Anomalous Researcher',
        desc: 'Listened to 3 transmissions from the Wexton Hospital.',
        icon: '🔬',
        hiddenGoal: true,
        condition: (data) => {
        const count = data.history.filter(id => {
        const ep = window.PodCube?.findEpisode?.(id);
        return ep?.origin?.includes('Wexton');
        }).length;
        return count >= 3;
        },
        reward: {
            type: 'game',
            gameId: 'wexton-terminal-hack',
            buttonText: 'LAUNCH WEXTON OVERRIDE',
        }
    });

    PodUser.registerAchievement({
        id: 'frequent_visitor',
        title: 'Dependable Asset',
        desc: 'Logged into the PRIC terminal 5 separate times.',
        icon: '🖥️',
        condition: (data) => data.visits >= 5,
        reward: {
            type: 'audio',
            meta: {
                url: './assets/audio/secret_voicemail_01.mp3',
                title: 'Stove\'s Voicemail',
                description: 'An intercepted message regarding the alligator populations.',
                model: 'PRIC Internal Comm',
                origin: 'Stove\'s Desk',
                locale: 'Miami',
                region: 'FL',
                zone: 'USA',
                planet: 'Earth',
                date: '2050-11-04',
            }
        }
    });

    PodUser.registerAchievement({
        id: 'first_punchcard',
        title: 'Record Keeper',
        desc: 'Printed your first Punchcard.',
        icon: '🎴',
        condition: (data) => data.punchcards >= 1,
    });

    PodUser.registerAchievement({
        id: 'game_gamer',
        title: 'Productivity Module Expert',
        desc: 'Scored 50 or higher in Adiabatic Dash.',
        icon: '🕹️',
        hiddenGoal: true,
        condition: (data) => (data.games['freaky-frogger'] || 0) >= 50,
        reward: {
            type: 'video',
            url: './assets/video/prabo_congratulations.mp4',
        }
    });

});
