// SC_TRANSMISSIONS.js

import { PodCubeScreen } from "../classes/PodCube_Screen.js";

export class SC_TRANSMISSIONS extends PodCubeScreen {

    // --- 1. Class Properties (Initialization) ---
    constructor(symbol) {
        super(symbol);
        this.episodeSymbols = [];
        this.filterOptionsSymbols = []; // Renamed for clarity in populateFilterOptions
        this.filterGroupsSymbols = [];  // Renamed for clarity in populateFilterGroups
        this.selectedIndex = 0;     // Index of the currently selected episode symbol
        this.listView = null;
        this.scrollContainer = null; // General scroll container reference (now handled by _makeScrollContainer return)

        // UI-related padding/sizing
        this.listItemHeight = 120; // Consistent vertical space for each list item
        this.detailsPadding = 0;   // Dynamic padding for details view

        // --- NEW: Current Filtering & Sorting Criteria ---
        this.currentCriteria = {
            // searchQuery: null, // REMOVED: No search functionality via fixed buttons
            tag: null,
            model: null,
            origin: null,
            zone: null,
            locale: null,
            region: null,
            year: null,
            sortBy: "published", // Default sort by published date
            sortAscending: false, // Default to descending (newest first for published date)
            // UI state: tracks which filter category is currently selected in the filter options list
            activeFilterCategory: 'sortBy' // Default filter category selected in UI
        };

        // --- NEW: Map for Filter Option to Feed Method and Display ---
        this._filterOptionMapping = {
            // Key in currentCriteria : { Display Label, PodCube.Feed getter for values, (optional) custom values for sortBy }
            // searchQuery: { label: "Search", isSearch: true }, // REMOVED
            tag: { label: "Tags", getter: "getAvailableTags" },
            model: { label: "Models", getter: "getAvailableModels" },
            origin: { label: "Origins", getter: "getAvailableOrigins" },
            zone: { label: "Zones", getter: "getAvailableZones" },
            locale: { label: "Locales", getter: "getAvailableLocales" },
            region: { label: "Regions", getter: "getAvailableRegions" },
            year: { label: "Years", getter: "getAvailableYears" },
            sortBy: { label: "Sort By", getter: null, customValues: ['published', 'rawDate', 'title', 'duration', 'integrity'] }
        };

        // --- NEW: Map for Sort By value to Display Label ---
        this._sortByLabels = {
            published: "Published Date",
            rawDate: "Episode Date",
            title: "Title",
            duration: "Duration",
            integrity: "Integrity"
        };
    }

    // --- 2. Lifecycle Methods (Init, Show, Destroy) ---
    onShow() {
        PodCube.log('SC_TRANSMISSIONS: Screen shown.');
    }

    onInit() {
        this._initializeDisplayObjects(); // Setup core display objects
        this.registerContexts();         // Define user interaction contexts

        this.populateFilterOptions(); // Populate filter categories initially
        
        // Initialize with all episodes from feed based on default criteria
        this.refreshEpisodeList();

        PodCube.log("SC_TRANSMISSIONS: Contexts registered.");
        this.switchContext("Transmissions:List"); // Default context on init
        this.symbol.playToLabel("transmissions")
    }

    onDestroy() {
        super.onDestroy(); // Call parent class's cleanup
        PodCube.log("SC_TRANSMISSIONS: Destroyed.");
    }

    // --- 3. Core Initialization Helpers (Private Methods) ---
    _initializeDisplayObjects() {
        // --- LIST VIEW ---
        this.listView = this.symbol.LISTVIEW;
        if (!this.listView) {
            console.error("SC_TRANSMISSIONS: LISTVIEW instance not found. Cannot proceed.");
            return;
        }
        this.episodeList = this._makeScrollContainer(this.listView);

        // --- FILTER VIEWS ---
        // Ensure filterOptions and filterGroups are properly hidden/shown via Animate labels
        this.filterOptionsList = this._makeScrollContainer(this.symbol.frame.filterOptions.list);
        this.filterGroupsList = this._makeScrollContainer(this.symbol.frame.filterGroups.list);
        this.filterGroupsIndicator = this.symbol.frame.filterGroups.activeIndicator;
        this.filterOptionsIndicator = this.symbol.frame.filterOptions.activeIndicator;

        this.filterOptionsListItem = PodCube.lib.LI_FILTEROPTION;
        this.filterGroupsListItem = PodCube.lib.LI_FILTERGROUP;
        this.episodeSymbol = PodCube.lib._EPISODE;
    }

    _makeScrollContainer(parentSymbol) {
        const scrollContainer = new createjs.Container();
        parentSymbol.addChild(scrollContainer);

        // Mask
        const mask = new createjs.Shape();
        const bounds = parentSymbol.nominalBounds;
        mask.graphics.beginFill("#000").drawRect(0, 0, bounds.width, bounds.height);
        scrollContainer.mask = mask;

        // State for this specific scroll container
        scrollContainer.symbols = [];
        scrollContainer.selectedIndex = 0;
        scrollContainer.totalContentHeight = 0;
        scrollContainer.parentSymbol = parentSymbol; // Reference to its parent symbol in Animate
        parentSymbol._scrollContainer = scrollContainer; // Store reference on Animate symbol too

        return scrollContainer;
    }

    // --- Populate Methods ---

    /**
     * Populates the visual episode symbols based on a provided array of Episode objects.
     * Clears existing symbols and re-renders the list.
     * @param {Episode[]} episodesToRender - The list of Episode objects to render.
     */
    populateEpisodeSymbols(episodesToRender) {
        const sc = this.episodeList;
        sc.removeAllChildren();
        sc.symbols = [];
        sc.selectedIndex = 0;

        let yOffset = 0;
        episodesToRender.forEach((episode) => {
            const episodeSymbol = new this.episodeSymbol();
            episodeSymbol.episode = episode;
            episodeSymbol.gotoAndStop("list-unselected"); // Default state
            episodeSymbol.x = 0; // Ensure X is 0 relative to scrollContainer
            episodeSymbol.y = yOffset;
            episodeSymbol.originalY = yOffset; // Store original Y for detail padding
            yOffset += this.listItemHeight; // Increment offset by consistent item height

            sc.symbols.push(episodeSymbol);
            sc.addChild(episodeSymbol);

            // Adjust title position for single-line titles if needed
            episodeSymbol.titleCentered.text = episode.title;
            const titleBounds = episodeSymbol.titleCentered.getBounds();
            if (titleBounds && titleBounds.height <= 45) { // Assuming 45 is max single line height
                episodeSymbol.titleCentered.y += titleBounds.height / 2;
            } else if (!titleBounds) {
                PodCube.warn("SC_TRANSMISSIONS: titleCentered.getBounds() returned null for episode:", episode.title);
            }
        });
        sc.totalContentHeight = episodesToRender.length * this.listItemHeight;
    }

    /**
     * Populates the filter options list (e.g., "Tags", "Models", "Years", "Sort By").
     * This list determines which filter category the user wants to adjust.
     */
    populateFilterOptions() {
        const sc = this.filterOptionsList;
        sc.removeAllChildren();
        sc.symbols = [];
        sc.selectedIndex = 0; // Will be updated below based on activeFilterCategory

        let yOffset = 0;
        // Filter out 'searchQuery' as it's no longer supported by navigation buttons
        const optionsKeys = Object.keys(this._filterOptionMapping).filter(key => key !== 'searchQuery');

        optionsKeys.forEach((key, index) => {
            const config = this._filterOptionMapping[key];
            const optionSymbol = new this.filterOptionsListItem();
            optionSymbol.label.text = config.label;
            optionSymbol.filterKey = key; // Store the criteria key on the symbol for easy access

            optionSymbol.gotoAndStop("list-unselected");
            optionSymbol.x = 0;
            optionSymbol.y = yOffset;
            yOffset += optionSymbol.nominalBounds.height * 1.05; // Use symbol's actual height

            sc.symbols.push(optionSymbol);
            sc.addChild(optionSymbol);

            // Set initial selected index based on activeFilterCategory
            if (key === this.currentCriteria.activeFilterCategory) {
                sc.selectedIndex = index;
            }
        });

        sc.totalContentHeight = optionsKeys.length * (this.filterOptionsListItem.prototype.nominalBounds.height * 1.05);

        // Reset scroll position and highlight the selected option
        sc.y = 0;
        if (sc.symbols[sc.selectedIndex]) {
            sc.symbols[sc.selectedIndex].gotoAndStop("list-selected");
        }
        this.scrollSelectionToCenter(sc); // Ensure selected option is visible
        stage.update();
    }

    /**
     * Populates the filter group list based on the currently selected filter category.
     * @param {string} filterCategoryKey - The key from _filterOptionMapping (e.g., 'tag', 'year', 'sortBy').
     */
    populateFilterGroups(filterCategoryKey) {
        const sc = this.filterGroupsList;
        sc.removeAllChildren();
        sc.symbols = [];
        sc.selectedIndex = 0; // Reset index for new group

        const config = this._filterOptionMapping[filterCategoryKey];
        let valuesToDisplay = [];

        if (config.getter && PodCube.Feed[config.getter]) {
            // Get values from PodCube.Feed for categories like tags, years, etc.
            valuesToDisplay = PodCube.Feed[config.getter]();
            // Add "All X" option for categories that can be nullified
            valuesToDisplay.unshift(`All ${config.label}`); // Add "All X" for non-sortBy filters
        } else if (config.customValues) {
            // Use custom values for 'sortBy'
            valuesToDisplay = config.customValues.map(val => {
                return this._sortByLabels[val] || val; // Use display label if available
            });
        } else {
            PodCube.warn(`SC_TRANSMISSIONS: No getter or custom values defined for filter category: ${filterCategoryKey}`);
            return;
        }

        let yOffset = 0;
        valuesToDisplay.forEach((value, index) => {
            const groupSymbol = new this.filterGroupsListItem();
            groupSymbol.label.text = String(value);
            groupSymbol.filterValue = value; // Store the actual value for applying

            groupSymbol.gotoAndStop("list-unselected");
            groupSymbol.x = 0;
            groupSymbol.y = yOffset;
            yOffset += groupSymbol.nominalBounds.height * 1.05;

            sc.symbols.push(groupSymbol);
            sc.addChild(groupSymbol);

            // Set selected index for this group if its value matches currentCriteria
            let currentSelectedValue;
            if (filterCategoryKey === 'sortBy') {
                currentSelectedValue = this._sortByLabels[this.currentCriteria.sortBy] || this.currentCriteria.sortBy;
            } else {
                 currentSelectedValue = this.currentCriteria[filterCategoryKey];
            }

            if (value === currentSelectedValue) {
                sc.selectedIndex = index;
            } else if (value === `All ${config.label}` && currentSelectedValue === null) {
                sc.selectedIndex = index; // Select "All X" if no specific filter is active
            }
        });

        sc.totalContentHeight = valuesToDisplay.length * (this.filterGroupsListItem.prototype.nominalBounds.height * 1.05);

        // Reset scroll position and highlight the selected option
        sc.y = 0;
        if (sc.symbols[sc.selectedIndex]) {
            sc.symbols[sc.selectedIndex].gotoAndStop("list-selected");
        }
        this.scrollSelectionToCenter(sc); // Ensure selected group value is visible
        stage.update();
    }


    // --- 4. Event Handlers ---
    /**
     * Handler for when PodCube.Feed's episode list changes or criteria are updated.
     * This method is responsible for updating the UI.
     */
    refreshEpisodeList() {
        if (PodCube.Feed == null) {
            this.feedSub = true;
            PodCube.MSG.subscribe("Feed-Ready", this.refreshEpisodeList.bind(this));
            return;
        }

        if (this.feedSub && PodCube.Feed != null) {
            PodCube.MSG.unsubscribe("Feed-Ready", this.refreshEpisodeList.bind(this));
            this.feedSub = false;
        }

        PodCube.log("SC_TRANSMISSIONS: Refreshing episode list with criteria:", this.currentCriteria);
        const episodesToDisplay = PodCube.Feed.getFilteredAndSortedList(this.currentCriteria);
        this.populateEpisodeSymbols(episodesToDisplay); // Re-render visual list
        this.updateSelection(0, this.episodeList); // Reset selection to the first item
        stage.update(); // Refresh the display

        // Recalculate padding needed for the details view
        this.detailsPadding = (this.selectedItem && this.selectedItem.getBounds()) ?
            (this.selectedItem.getBounds().height) * 4 + 140 : 0;

        PodCube.MSG.log(`SC_TRANSMISSIONS: Transmissions list ready (${episodesToDisplay.length} episodes).`);
    }

    // --- 5. Context Management and User Interactions ---
    registerContexts() {
        // Context for navigating the episode list
        this.defineContext("Transmissions:List", {
            up: { hint: "Upward", handler: () => this.navigate(-1) },
            down: { hint: "Down", handler: () => this.navigate(1) },
            right: { hint: "Details", handler: () => this.showDetails() },
            yes: { hint: "Add to Queue", handler: () => this._addSelectedEpisodeToQueue() },
            no: { hint: "Filter/Sort", handler: () => this.showFilters() },
            left: { hint: "Back", handler: () => this.showFilters() }
        });

        // Context for viewing episode details
        this.defineContext("Transmissions:Details", {
            up: {
                hint: "Previous", handler: () => {
                    this.showList();
                    this.navigate(-1);
                    this.showDetails();
                }
            },
            down: {
                hint: "Next", handler: () => {
                    this.showList();
                    this.navigate(1);
                    this.showDetails();
                }
            },
            left: { hint: "Back", handler: () => this.showList() },
            yes: { hint: "Add to Queue", handler: () => this._addSelectedEpisodeToQueue() },
            no: { hint: "Play Next", handler: () => PodCube.Player.addNextToQueue(this.selectedEpisode) },
        });

        // Context for navigating Filter Categories (Tags, Models, Years, Sort By)
        this.defineContext("Transmissions:Filters", {
            up: {
                hint: "Upward",
                handler: () => { this.navigate(-1, this.filterOptionsList); },
            },
            down: {
                hint: "Down",
                handler: () => { this.navigate(1, this.filterOptionsList); },
            },
            left: {
                hint: "Back",
                handler: () => { this.showList(); }, // Go back to episode list
            },
            right: {
                hint: "Enter Category",
                handler: () => { this.enterFilterCategory(); },
            },
            yes: {
                hint: "Happy!", // 'Yes' doesn't do much directly on categories, 'Right' enters
                handler: () => { PodCube.MSG.log("Press RIGHT to enter filter category. NO toggles sort order."); },
            },
            no: {
                hint: "Sort By...",
                handler: () => { this.showSortByOptions(); }, // Toggle sort order for "Sort By"
            },
        });

        // Context for navigating Filter Group Values (e.g., specific years, tags, sortBy values)
        this.defineContext("Transmissions:FilterGroups", {
            up: {
                hint: "Upward",
                handler: () => { this.navigate(-1, this.filterGroupsList); },
            },
            down: {
                hint: "Down",
                handler: () => { this.navigate(1, this.filterGroupsList); },
            },
            left: {
                hint: "Back",
                handler: () => { this.exitFilterCategory(); }, // Go back to filter categories
            },
            right: {
                hint: "Apply Filter",
                handler: () => { this.applyFilterGroupSelection(); },
            },
            yes: {
                hint: "Apply Filter",
                handler: () => { this.applyFilterGroupSelection(); },
            },
            no: {
                hint: "Sort By...", // Or just 'Back'
                handler: () => { this.showSortByOptions(); },
            },
        });
    }

    // --- 6. UI State Management (Show/Hide/Transition) ---
    showDetails() {
        this.switchContext("Transmissions:Details");
        this._adjustPaddingForDetails();
        this.selectedItem.gotoAndStop("details"); // Show details state of the symbol
        this.scrollToTop(this.selectedItem);       // Scroll selected item to top of view
        this.prevIndex = this.episodeList.getChildIndex(this.selectedItem);
        this.episodeList.setChildIndex(this.selectedItem, this.episodeList.numChildren - 1);
        stage.update();
    }

    showList() {
        this.symbol.playToLabel("transmissions"); // Transition to list view
        this.switchContext("Transmissions:List");
        this._adjustPaddingForDetails(); // Reset padding
        if (this.prevIndex !== undefined) {
            this.episodeList.setChildIndex(this.selectedItem, this.prevIndex);
            this.prevIndex = undefined;
        }
        if(this.selectedItem) { // Check if there's a selected item
             this.selectedItem.gotoAndStop("list-selected"); // Show list state of the symbol
        }
        this.scrollSelectionToCenter(this.episodeList); // Center the selection
        this.listView.visible = true; // Ensure list view is visible
        stage.update();
    }

    showFilters() {
        this.symbol.playToLabel("filters"); // Transition to filter view
        this.switchContext("Transmissions:Filters");
        this.populateFilterOptions(); // Re-populate filter categories
    }

    /**
     * Adjusts the Y position of episode symbols following the selected one
     * to make space for the details view.
     */
    _adjustPaddingForDetails() {
        const padding = this.detailsPadding || 0;
        const isDetailsContext = this.context.name === "Transmissions:Details";

        // Only adjust symbols AFTER the selected one
        const startIndex = this.episodeList.selectedIndex + 1;
        for (let i = startIndex; i < this.episodeList.symbols.length; i++) {
            const episodeSymbol = this.episodeList.symbols[i];
            episodeSymbol.y = isDetailsContext ? episodeSymbol.originalY + padding : episodeSymbol.originalY;
        }
        stage.update();
    }

    /**
     * Navigates to the next or previous item in the specified list.
     * @param {number} direction - The direction of navigation (1 for forward, -1 for backward).
     * @param {createjs.Container} sc - The scroll container (defaults to episodeList).
     */
    navigate(direction, sc = this.episodeList) {
        this.updateSelection(sc.selectedIndex + direction, sc);
    }

    /**
     * Updates the currently selected item in a list.
     * Handles visual state changes and triggers scrolling.
     * @param {number} newIndex - The index to select.
     * @param {createjs.Container} sc - The scroll container.
     */
    updateSelection(newIndex, sc) {
        const numItems = sc.symbols.length;
        if (numItems === 0) {
            if (sc.selectedIndex !== -1 && sc.symbols[sc.selectedIndex]) {
                sc.symbols[sc.selectedIndex].gotoAndStop("list-unselected");
            }
            sc.selectedIndex = -1;
            return;
        }
        if (sc.selectedIndex !== -1 && sc.symbols[sc.selectedIndex]) {
            sc.symbols[sc.selectedIndex].gotoAndStop("list-unselected");
        }
        sc.selectedIndex = (newIndex % numItems + numItems) % numItems;
        if (sc.symbols[sc.selectedIndex]) {
            sc.symbols[sc.selectedIndex].gotoAndStop("list-selected");
        }
        this.scrollSelectionToCenter(sc);
        stage.update();
    }

    /**
     * Scrolls the list container to bring the selected item into view,
     * aiming to place it near the top (30% down).
     * @param {createjs.Container} sc - The scroll container.
     */
    scrollSelectionToCenter(sc) {
        const selectedSymbol = sc.symbols[sc.selectedIndex];
        if (!selectedSymbol) {
            createjs.Tween.get(sc).to({ y: 0 }, 300, createjs.Ease.quadOut);
            return;
        }

        const listViewHeight = sc.parentSymbol.nominalBounds.height;
        const contentHeight = sc.totalContentHeight; // Total height of all items

        let targetY = -(selectedSymbol.y - (listViewHeight * 0.3));

        const maxScrollY = 0;
        let minScrollY = -(contentHeight - listViewHeight);
        if (minScrollY > 0) {
            minScrollY = 0;
        }

        targetY = Math.max(Math.min(targetY, maxScrollY), minScrollY);

        createjs.Tween.get(sc).to({ y: targetY }, 300, createjs.Ease.quadOut);
    }

    /**
     * Scrolls the list container to bring a specific symbol (or the first one by default) to the very top.
     * Used for "Scroll to Top" or when entering details view.
     * @param {createjs.DisplayObject} symbolToScrollTo - The symbol to scroll to.
     * @param {createjs.Container} sc - The scroll container.
     */
    scrollToTop(symbolToScrollTo, sc = this.episodeList) {
        if (!symbolToScrollTo) return;
        const targetY = symbolToScrollTo.y;
        createjs.Tween.get(sc).to({ y: -targetY }, 300, createjs.Ease.quadOut);
    }

    // --- NEW: Filter Specific Methods ---

    /**
     * Called when 'right' is pressed in the Transmissions:Filters context.
     * Transitions to the filter groups list for the selected category.
     */
    enterFilterCategory() {
        const selectedOptionSymbol = this.filterOptionsList.symbols[this.filterOptionsList.selectedIndex];
        if (!selectedOptionSymbol) return;

        
        this.currentCriteria.activeFilterCategory = selectedOptionSymbol.filterKey;
        PodCube.log(`SC_TRANSMISSIONS: Entering filter category: ${this.currentCriteria.activeFilterCategory}`);

        // Populate and switch to filter group context
        this.populateFilterGroups(this.currentCriteria.activeFilterCategory);
        this.switchContext("Transmissions:FilterGroups");
        this.filterGroupsIndicator.visible = true;
        this.filterOptionsIndicator.visible = false;
    }

    /**
     * Called when 'left' is pressed in the Transmissions:FilterGroups context.
     * Transitions back to the filter options list.
     */
    exitFilterCategory() {
        PodCube.log("SC_TRANSMISSIONS: Exiting filter category.");
        this.symbol.playToLabel("filters"); // Transition back to filter categories view
        this.switchContext("Transmissions:Filters");
        this.filterGroupsList.symbols[this.filterGroupsList.selectedIndex].gotoAndStop("list-unselected");
        this.populateFilterOptions(); // Re-highlight the selected option and indicators
        this.filterGroupsIndicator.visible = false;
        this.filterOptionsIndicator.visible = true;
    }
 /**
     * Called when 'no' is pressed in the Transmissions:Filters context.
     * Directly shows the "Sort By" options *and* handles sort order toggling.
     */
    showSortByOptions() {
        PodCube.log("SC_TRANSMISSIONS: Showing Sort By options.");
        this.currentCriteria.activeFilterCategory = 'sortBy';

        // Toggle sort order
        this.currentCriteria.sortAscending = !this.currentCriteria.sortAscending;
        PodCube.log(`SC_TRANSMISSIONS: Sort order flipped to Ascending: ${this.currentCriteria.sortAscending}`);
        this.refreshEpisodeList(); // Refresh list with new sort order
        // Update the display for the sort order text if you have one
        if (this.symbol.frame.sortOrder) { // Check if the sortOrder text field exists
            this.symbol.frame.sortOrder.text = this.currentCriteria.sortAscending ? 'Ascending' : 'Descending';
        }

        // Ensure "Sort By" option is selected in filterOptionsList for visual consistency
        const sortByOptionIndex = Object.keys(this._filterOptionMapping).filter(key => key !== 'searchQuery').indexOf('sortBy');
        if (sortByOptionIndex !== -1) {
            this.updateSelection(sortByOptionIndex, this.filterOptionsList);
        }

        this.populateFilterGroups(this.currentCriteria.activeFilterCategory);
        this.switchContext("Transmissions:FilterGroups");
        this.filterGroupsIndicator.visible = true;
        this.filterOptionsIndicator.visible = false;
    }

    applyFilterGroupSelection() {
        const selectedGroupSymbol = this.filterGroupsList.symbols[this.filterGroupsList.selectedIndex];
        if (!selectedGroupSymbol) return;

        const categoryKey = this.currentCriteria.activeFilterCategory;
        let selectedValue = selectedGroupSymbol.filterValue;
        const config = this._filterOptionMapping[categoryKey];

        // Only clear existing *category* filters (not sortBy)
        if (categoryKey !== 'sortBy') {
            Object.keys(this._filterOptionMapping).forEach(key => {
                if (key !== 'sortBy' && this.currentCriteria[key] !== undefined) {
                    this.currentCriteria[key] = null; // Clear existing category filters
                }
            });
        }

        // Apply the new filter value or set to null if "All X" is selected
        if (categoryKey === 'sortBy') {
            // Convert display label back to internal value for sortBy
            const internalSortByValue = Object.keys(this._sortByLabels).find(key => this._sortByLabels[key] === selectedValue);
            this.currentCriteria.sortBy = internalSortByValue || selectedValue;
        } else if (selectedValue.startsWith('All ')) {
             this.currentCriteria[categoryKey] = null; // Set filter to null to show all
        } else {
             this.currentCriteria[categoryKey] = selectedValue;
        }

        PodCube.log(`SC_TRANSMISSIONS: Applied filter: ${categoryKey} = ${this.currentCriteria[categoryKey]}`);
        this.refreshEpisodeList(); // Refresh main episode list
        this.showList(); // Go back to episode list view
    }


    /**
     * Called when 'no' is pressed in the Transmissions:Filters context.
     * Toggles the sort order (ascending/descending).
     */
    flipSortOrder() {
        // Only allow flipping sort order if "Sort By" is the active filter category
        const selectedOptionSymbol = this.filterOptionsList.symbols[this.filterOptionsList.selectedIndex];
        if (selectedOptionSymbol && selectedOptionSymbol.filterKey === 'sortBy') {
            this.currentCriteria.sortAscending = !this.currentCriteria.sortAscending;
            PodCube.log(`SC_TRANSMISSIONS: Sort order flipped to Ascending: ${this.currentCriteria.sortAscending}`);
            this.refreshEpisodeList(); // Refresh list with new sort order
            this.symbol.frame.sortOrder.text = this.currentCriteria.sortAscending ? 'Ascending' : 'Descending'
        } else {
            PodCube.MSG.log("Sort order only applies to 'Sort By' category.");
        }
    }


    // --- 7. Getters (Computed Properties) ---
    get selectedEpisode() {
        return this.episodeList.symbols[this.episodeList.selectedIndex]?.episode || null;
    }

    get selectedItem() {
        return this.episodeList.symbols[this.episodeList.selectedIndex] || null;
    }

    // --- 8. Private Helper Methods for Context Handlers ---
    _addSelectedEpisodeToQueue() {
        const episode = this.selectedEpisode;
        if (episode) {
            PodCube.log("SC_TRANSMISSIONS: Episode added to queue:", episode.title);
            PodCube.Player.addToQueue(episode);
        } else {
            PodCube.warn("SC_TRANSMISSIONS: No episode selected to add to queue.");
        }
    }

    _scrollToTopAndResetSelection() {
        this.updateSelection(0, this.episodeList); // Select the first item
        this.scrollToTop(this.episodeList.symbols[0], this.episodeList); // Scroll to the very top
    }
}