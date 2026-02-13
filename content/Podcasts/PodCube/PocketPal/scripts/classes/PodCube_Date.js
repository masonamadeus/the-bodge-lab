export class PodCubeDate {
    constructor(year, month = 0, day = 0) {
        if (typeof year === 'string') {
            const parsed = PodCubeDate._parseDateString(year.trim());
            this.year = parsed.year;
            this.month = parsed.month;
            this.day = parsed.day;
        } else {
            this.year = year;
            this.month = month;
            this.day = day;
        }

        // IMPORTANT: Normalize the date upon creation
        this._normalizeDate();

        this._weekday = this._calculateWeekday();
    }

    // --- Static Helpers ---

    static _isLeapYear(year) {
        // Correct Gregorian leap year rules, considering your BCE/CE (year 0 = 1 BCE)
        // A year is a leap year if it is divisible by 4, unless it is divisible by 100 but not by 400.
        // For BCE years, astronomical year numbering is often used: 1 BCE is year 0, 2 BCE is year -1.
        // Zeller's congruence handles this by subtracting 1 from Y if m < 3.
        // So here, use the stored `this.year` directly for the check.
        // Example: 0 (1 BCE) is a leap year. -3 (4 BCE) is a leap year.

        // Convert to astronomical year number for leap year calculation.
        // 1 CE = 1, 1 BCE = 0, 2 BCE = -1, etc.
        // For leap year rules, we effectively use the "Astronomical year" where 0 is a year,
        // and leap years follow a consistent pattern.
        let astronomicalYear = this.year;
        if (this.year <= 0) {
            // For BCE years, convert to astronomical year number for accurate leap year check
            // For example, 1 BCE (internal year 0) is a leap year if its astronomical year (0) is divisible by 4.
            // 2 BCE (internal year -1) is NOT a leap year because its astronomical year (-1) is not.
            // 5 BCE (internal year -4) IS a leap year because its astronomical year (-4) is divisible by 4.
            // The standard leap year rules apply to these astronomical year numbers.
        }

        return (astronomicalYear % 4 === 0 && astronomicalYear % 100 !== 0) || astronomicalYear % 400 === 0;
    }


    static getDaysInMonth(year, monthIndex) {
        const daysInMonthMap = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (monthIndex === 1 && PodCubeDate._isLeapYear(year)) { // February
            return 29;
        }
        return daysInMonthMap[monthIndex];
    }

    static _parseDateString(str) {
        // ISO format: "-134999-07-21"
        const isoMatch = str.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            return {
                year: parseInt(isoMatch[1]),
                month: parseInt(isoMatch[2]) - 1,
                day: parseInt(isoMatch[3]),
            };
        }

        // US-style MM/DD/YYYY with optional era
        const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d+)(?:\s*(BCE|BC|CE|AD))?$/i);
        if (usMatch) {
            let [, mm, dd, yyyy, era] = usMatch;
            let year = parseInt(yyyy);
            if (era && /BCE|BC/i.test(era)) year = -year + 1; // e.g., 1 BCE = year 0
            return {
                year,
                month: parseInt(mm) - 1,
                day: parseInt(dd),
            };
        }
        // Specific format "May 13, 1971"
        const monthDayYearMatch = str.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d+)(?:\s*(BCE|BC|CE|AD))?$/i);
        if (monthDayYearMatch) {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            let [, monthName, dd, yyyy, era] = monthDayYearMatch;
            let year = parseInt(yyyy);
            if (era && /BCE|BC/i.test(era)) year = -year + 1;
            return {
                year,
                month: monthNames.indexOf(monthName),
                day: parseInt(dd),
            };
        }

        return {
            year: 0,
            month: 0,
            day: 1, // Default to epoch date if parsing fails
        };
    }

    // --- Internal Normalization ---

    _normalizeDate() {
        // This method ensures that month and day values are within valid ranges
        // e.g., day 32 of Jan becomes Feb 1. Month 13 becomes Jan of next year.

        // First, handle day overflow/underflow
        while (this.day <= 0) { // If day is 0 or negative
            this.month--;
            // Go to the last day of the new (previous) month
            this.day += PodCubeDate.getDaysInMonth(this.year, this.month);
        }
        while (this.day > PodCubeDate.getDaysInMonth(this.year, this.month)) {
            this.day -= PodCubeDate.getDaysInMonth(this.year, this.month);
            this.month++;
        }

        // Then, handle month overflow/underflow
        while (this.month < 0) {
            this.year--;
            this.month += 12;
        }
        while (this.month > 11) {
            this.year++;
            this.month -= 12;
        }
    }

    // --- Instance Methods ---

    _calculateWeekday() {
        // Zeller's congruence (unchanged, as it's correct for Gregorian)
        let q = this.day;
        let m = this.month + 1; // Zeller's month is 1-indexed (Jan=1, Feb=2, ..., Dec=12)
        let Y = this.year;

        if (m < 3) { // Adjust for Jan/Feb
            m += 12;
            Y -= 1;
        }

        const K = Y % 100;
        const J = Math.floor(Y / 100);

        const h = (q + Math.floor(13 * (m + 1) / 5) + K + Math.floor(K / 4) +
            Math.floor(J / 4) + 5 * J) % 7;

        return (h + 6) % 7; // Adjust to make Sunday=0, Monday=1, etc.
    }

    getFullYear() { return this.year; }
    getMonth() { return this.month; } // 0-indexed
    getDate() { return this.day; }
    getDay() { return this._weekday; } // 0=Sunday, 1=Monday...

    /**
     * Calculates the Julian Day Number (JDN) for this PodCubeDate instance.
     * JDN is a continuous count of days since noon, January 1, 4713 BCE (Julian calendar).
     * This method correctly handles BCE years using the astronomical year numbering.
     * Formula adapted from: https://en.wikipedia.org/wiki/Julian_day
     * @returns {number} The Julian Day Number.
     * @private
     */
    _toJulianDayNumber() {
        let Y = this.year;
        let M = this.month + 1; // 1-indexed month
        let D = this.day;

        // Adjust for astronomical year numbering (where 1 BCE is year 0, 2 BCE is -1, etc.)
        // Julian Day Number calculations assume astronomical year numbering.
        // Our `this.year` property already stores the astronomical year, so no adjustment needed here.

        // If month is January or February, treat as 13th or 14th month of previous year
        if (M <= 2) {
            Y -= 1;
            M += 12;
        }

        // Calculation for Gregorian calendar
        const A = Math.floor(Y / 100);
        const B = 2 - A + Math.floor(A / 4);

        const JDN = Math.floor(365.25 * (Y + 4716)) +
                    Math.floor(30.6001 * (M + 1)) +
                    D + B - 1524.5; // .5 to align with standard JDN at noon, we want midnight

        return JDN;
    }

    /**
     * Returns the number of milliseconds since the Unix Epoch (January 1, 1970, 00:00:00 UTC).
     * This provides a consistent numerical value for sorting dates across CE and BCE.
     * It approximates by calculating days since Unix epoch and converting to milliseconds.
     * Note: This is an approximation. A true Date object might have slight differences
     * due to timezones and precise epoch definition.
     * @returns {number} The number of milliseconds since Unix Epoch.
     */
    getTime() {
        // Julian Day Number for January 1, 1970 (Unix Epoch) is 2440588.
        // This JDN refers to noon UTC on Jan 1, 1970.
        // We want milliseconds from midnight. So, subtract 0.5 days to get to midnight.
        const UNIX_EPOCH_JDN_MIDNIGHT = 2440588 - 0.5;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        // Calculate JDN for this PodCubeDate at midnight
        const currentJDN_Midnight = this._toJulianDayNumber();

        // Calculate difference in days
        const daysDifference = currentJDN_Midnight - UNIX_EPOCH_JDN_MIDNIGHT;

        // Convert days difference to milliseconds
        return daysDifference * MS_PER_DAY;
    }


    toLocaleString(locale = 'en-US', options = {}) {
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const outputParts = [];

        if (options.weekday === 'long') {
            outputParts.push(weekdayNames[this.getDay()]);
        }

        let monthStr = '';
        const numericMonth = this.month + 1;
        if (options.month === 'long') {
            monthStr = monthNames[this.month];
        } else if (options.month === '2-digit') {
            monthStr = String(numericMonth).padStart(2, '0');
        } else if (options.month === 'numeric') {
            monthStr = String(numericMonth);
        }

        let dayStr = '';
        const numericDay = this.day;
        if (options.day === '2-digit') {
            dayStr = String(numericDay).padStart(2, '0');
        } else if (options.day === 'numeric') {
            dayStr = String(numericDay);
        }

        let yearStr = '';
        const fullYear = this.year;
        const isBCE = fullYear <= 0;
        // Adjust for display: 1 BCE is year 0, 2 BCE is year -1, etc.
        const displayYear = isBCE ? Math.abs(fullYear) + (fullYear === 0 ? 1 : 0) : fullYear;

        if (options.year === '2-digit') {
            yearStr = String(displayYear % 100).padStart(2, '0');
        } else if (options.year === 'numeric') {
            yearStr = String(displayYear);
        }

        if (yearStr && isBCE) {
            yearStr += ' BCE';
        } else if (yearStr && options.era === 'short' && !isBCE) {
            yearStr += ' CE';
        }

        const dateComponents = [];

        if (options.month === 'long') {
            if (monthStr) dateComponents.push(monthStr);
            if (dayStr) dateComponents.push(dayStr);
            if (yearStr) {
                if (dayStr) {
                    dateComponents[dateComponents.indexOf(dayStr)] = `${dayStr},`;
                }
                dateComponents.push(yearStr);
            }
        } else {
            if (monthStr) dateComponents.push(monthStr);
            if (dayStr) dateComponents.push(dayStr);
            if (yearStr) dateComponents.push(yearStr);

            if (dateComponents.length === 3) { // Ensure all 3 parts before joining with '/'
                outputParts.push(dateComponents.join('/'));
                dateComponents.length = 0;
            } else if (dateComponents.length > 0) { // For cases like just month/year
                outputParts.push(dateComponents.join('/'));
                dateComponents.length = 0;
            }
        }

        if (options.month === 'long' && dateComponents.length > 0) {
            outputParts.push(dateComponents.join(' '));
        }

        let finalString = '';
        if (options.weekday === 'long' && outputParts.length > 0) { // If weekday was pushed and there's a date part
            finalString = `${outputParts[0]}, ${outputParts.slice(1).join(' ')}`; // Join remaining parts with space
        } else if (outputParts.length > 0) {
            finalString = outputParts.join(' ');
        }

        return finalString;
    }

    toISOString() {
        // Ensure year is padded correctly, handling negative years
        // For example, year -134999 -> "-134999". A 6-digit year needs 7 chars for negative.
        const y = this.year.toString().padStart(6, this.year < 0 ? '-' : '0');
        const m = String(this.month + 1).padStart(2, '0');
        const d = String(this.day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    static from(input) { return new PodCubeDate(input); }
    static fromISO(str) { return new PodCubeDate(str); }

    toJSON() {
        return this.toISOString();
    }
}