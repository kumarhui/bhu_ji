document.addEventListener('DOMContentLoaded', () => {
    const allMessesToggle = document.getElementById('all-messes-status-toggle');
    const allCanteensToggle = document.getElementById('all-canteens-status-toggle');
    const autoSchedulerToggle = document.getElementById('auto-scheduler-toggle');

    const db = firebase.database();
    const schedulerSettingsRef = db.ref('admin/schedulerSettings');

    // --- Master Toggles Logic ---

    function handleMasterToggle(event, ownerType) {
        const newStatus = event.target.checked;
        const typeName = ownerType.charAt(0).toUpperCase() + ownerType.slice(1); // 'Mess' or 'Canteen'
        const confirmationMessage = `Are you sure you want to turn ${newStatus ? 'ON' : 'OFF'} all ${typeName}es?`;

        if (window.confirm(confirmationMessage)) {
            const dbRef = db.ref(`${ownerType}Owners`);
            dbRef.once('value').then(snapshot => {
                if (snapshot.exists()) {
                    const updates = {};
                    snapshot.forEach(childSnapshot => {
                        const uid = childSnapshot.key;
                        updates[`/${uid}/profile/messStatus`] = newStatus;
                    });
                    return dbRef.update(updates);
                }
            }).then(() => {
                alert(`All ${typeName}es have been turned ${newStatus ? 'ON' : 'OFF'}.`);
            }).catch(error => {
                console.error(`Failed to update all ${typeName}es:`, error);
                alert(`An error occurred. Could not update all ${typeName}es.`);
                event.target.checked = !newStatus;
            });
        } else {
            event.target.checked = !newStatus;
        }
    }

    if (allMessesToggle) allMessesToggle.addEventListener('change', (event) => handleMasterToggle(event, 'mess'));
    if (allCanteensToggle) allCanteensToggle.addEventListener('change', (event) => handleMasterToggle(event, 'canteen'));

    // --- Automatic Mess Status Scheduler ---

    // --- Default Schedule Definitions ---
    let MESS_SCHEDULE = [ { start: 11, end: 15 }, { start: 19, end: 23 } ];
    let CANTEEN_SCHEDULE = [ { start: 7, end: 10 }, { start: 15.5, end: 19 } ];

    // Helper to convert "HH:mm" string to a decimal number
    function timeToDecimal(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }

    // Helper to convert decimal number to "HH:mm" string
    function decimalToTime(decimal) {
        const hours = Math.floor(decimal);
        const minutes = Math.round((decimal - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function updateScheduleFromDB(settings) {
        if (settings.messSchedule) {
            MESS_SCHEDULE = settings.messSchedule.map(win => ({ start: timeToDecimal(win.start), end: timeToDecimal(win.end) }));
        }
        if (settings.canteenSchedule) {
            CANTEEN_SCHEDULE = settings.canteenSchedule.map(win => ({ start: timeToDecimal(win.start), end: timeToDecimal(win.end) }));
        }
    }
    function isOperatingTime(schedule) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour + (currentMinute / 60); // e.g., 3:30 PM is 15.5

        for (const window of schedule) {
            if (currentTime >= window.start && currentTime < window.end) {
                return true;
            }
        }
        return false;
    }

    function setAutomaticStatus(ownerType, newStatus) {
        const dbRef = db.ref(`${ownerType}Owners`);
        dbRef.once('value').then(snapshot => {
            if (snapshot.exists()) {
                const updates = {};
                snapshot.forEach(childSnapshot => {
                    updates[`/${childSnapshot.key}/profile/messStatus`] = newStatus;
                });
                return dbRef.update(updates);
            }
        }).catch(error => {
            console.error(`Automatic status update failed for ${ownerType}es:`, error);
        });
    }

    function runScheduler() {
        if (!autoSchedulerToggle || !autoSchedulerToggle.checked) {
            return;
        }

        // Check messes and canteens independently
        checkAndApplySchedule('mess', MESS_SCHEDULE);
        checkAndApplySchedule('canteen', CANTEEN_SCHEDULE);
    }

    function checkAndApplySchedule(ownerType, schedule) {
        const shouldBeOn = isOperatingTime(schedule);
        const sessionKey = `autoStatus_${ownerType}`;
        const lastKnownState = sessionStorage.getItem(sessionKey);
        const currentState = shouldBeOn ? 'ON' : 'OFF';

        if (lastKnownState !== currentState) {
            if (lastKnownState === 'MANUAL_OVERRIDE') {
                return;
            }
            console.log(`Scheduler: Setting ${ownerType}es to ${currentState}`);
            setAutomaticStatus(ownerType, shouldBeOn);
            sessionStorage.setItem(sessionKey, currentState);

            // Update the corresponding toggle switch on the UI
            const toggle = ownerType === 'mess' ? allMessesToggle : allCanteensToggle;
            if (toggle) toggle.checked = shouldBeOn;
        }
    }

    // --- Initialize Page ---

    function populateTimeInputs(settings) {
        const messDefaults = [ { start: "11:00", end: "15:00" }, { start: "19:00", end: "23:00" } ];
        const canteenDefaults = [ { start: "07:00", end: "10:00" }, { start: "15:30", end: "19:00" } ];

        const messSchedule = settings.messSchedule || messDefaults;
        const canteenSchedule = settings.canteenSchedule || canteenDefaults;

        document.getElementById('mess-start-1').value = messSchedule[0]?.start || '';
        document.getElementById('mess-end-1').value = messSchedule[0]?.end || '';
        document.getElementById('mess-start-2').value = messSchedule[1]?.start || '';
        document.getElementById('mess-end-2').value = messSchedule[1]?.end || '';

        document.getElementById('canteen-start-1').value = canteenSchedule[0]?.start || '';
        document.getElementById('canteen-end-1').value = canteenSchedule[0]?.end || '';
        document.getElementById('canteen-start-2').value = canteenSchedule[1]?.start || '';
        document.getElementById('canteen-end-2').value = canteenSchedule[1]?.end || '';
    }

    function saveTimings() {
        const saveBtn = document.getElementById('save-timings-btn');
        saveBtn.disabled = true;
        saveBtn.querySelector('.btn-text').textContent = 'Saving...';
        saveBtn.querySelector('.icon-loading').style.display = 'inline-block';

        const newSettings = {
            messSchedule: [
                { start: document.getElementById('mess-start-1').value, end: document.getElementById('mess-end-1').value },
                { start: document.getElementById('mess-start-2').value, end: document.getElementById('mess-end-2').value }
            ],
            canteenSchedule: [
                { start: document.getElementById('canteen-start-1').value, end: document.getElementById('canteen-end-1').value },
                { start: document.getElementById('canteen-start-2').value, end: document.getElementById('canteen-end-2').value }
            ]
        };

        schedulerSettingsRef.set(newSettings).then(() => {
            updateScheduleFromDB(newSettings); // Update running schedules
            saveBtn.querySelector('.btn-text').textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.querySelector('.btn-text').textContent = 'Save Timings';
                saveBtn.querySelector('.icon-loading').style.display = 'none';
            }, 2000);
        }).catch(error => {
            alert('Error saving timings: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.querySelector('.btn-text').textContent = 'Save Timings';
            saveBtn.querySelector('.icon-loading').style.display = 'none';
        });
    }

    // Load saved state for auto-scheduler toggle
    const savedSchedulerState = localStorage.getItem('autoSchedulerEnabled');
    if (autoSchedulerToggle) {
        autoSchedulerToggle.checked = savedSchedulerState !== 'false'; // Default to true
    }

    // Save state when changed
    if (autoSchedulerToggle) {
        autoSchedulerToggle.addEventListener('change', () => {
            localStorage.setItem('autoSchedulerEnabled', autoSchedulerToggle.checked);
            if (autoSchedulerToggle.checked) {
                // If re-enabled, clear manual override to let scheduler run
                sessionStorage.removeItem('autoStatus_mess'); sessionStorage.removeItem('autoStatus_canteen');
                runScheduler();
            }
        });
    }

    runScheduler();
    setInterval(runScheduler, 60000);

    // Load scheduler timings from Firebase
    schedulerSettingsRef.once('value').then(snapshot => {
        const settings = snapshot.val() || {};
        populateTimeInputs(settings);
        updateScheduleFromDB(settings);
        runScheduler(); // Run again with potentially new timings
    });

    document.getElementById('save-timings-btn').addEventListener('click', saveTimings);

    function disableAutoSchedulerForType(ownerType) {
        const sessionKey = `autoStatus_${ownerType}`;
        console.log(`Manual override for ${ownerType}. Disabling scheduler for this type for the session.`);
        sessionStorage.setItem(sessionKey, 'MANUAL_OVERRIDE');
    }
    if (allMessesToggle) allMessesToggle.addEventListener('change', () => disableAutoSchedulerForType('mess')); if (allCanteensToggle) allCanteensToggle.addEventListener('change', () => disableAutoSchedulerForType('canteen'));
});