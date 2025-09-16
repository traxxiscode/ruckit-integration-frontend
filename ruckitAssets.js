/**
 * Geotab Ruckit Assets Add-in
 * @returns {{initialize: Function, focus: Function, blur: Function}}
 */
geotab.addin.ruckitAssets = function () {
    'use strict';

    let api;
    let state;
    let elAddin;
    let assetsData = [];
    let filteredData = [];
    let currentSubdomain = '';
    let searchTerm = '';

    /**
     * Extract subdomain from current URL
     */
    function extractSubdomain() {
        try {
            const url = window.location.href;
            // Extract subdomain from URL like "https://my.geotab.com/traxxisdemo/#..."
            const match = url.match(/https?:\/\/my\.geotab\.com\/([^\/\#]+)/);
            if (match && match[1]) {
                currentSubdomain = match[1];
                console.log('Extracted subdomain:', currentSubdomain);
            } else {
                console.warn('Could not extract subdomain from URL:', url);
                currentSubdomain = '';
            }
        } catch (error) {
            console.error('Error extracting subdomain:', error);
            currentSubdomain = '';
        }
    }

    /**
     * Filter out placeholder entries
     */
    function filterPlaceholderEntries(data) {
        return data.filter(item => {
            const details = item.details || {};
            const ruckitDevice = details['ri-device'] || '';
            const ruckitDriver = details['ri-driver'] || '';
            const ruckitToken = details['ri-token'] || '';
            
            // Filter out entries with placeholder values
            return !(ruckitDevice === 'DeviceID' && 
                     ruckitDriver === 'DriverID' && 
                     ruckitToken === 'TOKEN');
        });
    }

    /**
     * Filter data based on search term
     */
    function filterDataBySearch(data, searchTerm) {
        if (!searchTerm.trim()) {
            return data;
        }
        
        const term = searchTerm.toLowerCase().trim();
        return data.filter(item => {
            const details = item.details || {};
            const assetName = (details.name || '').toLowerCase();
            return assetName.includes(term);
        });
    }

    /**
     * Apply all filters to the data
     */
    function applyFilters() {
        // First filter out placeholder entries
        let filtered = filterPlaceholderEntries(assetsData);
        
        // Then apply search filter
        filtered = filterDataBySearch(filtered, searchTerm);
        
        filteredData = filtered;
        renderAssetsTable(filteredData);
        updateSearchStats();
    }

    /**
     * Update search statistics
     */
    function updateSearchStats() {
        const searchResultsEl = document.getElementById('searchResults');
        const totalAssetsEl = document.getElementById('totalAssets');
        const assetCountEl = document.getElementById('assetCount');
        
        const validAssets = filterPlaceholderEntries(assetsData);
        const filteredCount = filteredData.length;
        
        if (searchResultsEl) {
            if (searchTerm.trim()) {
                searchResultsEl.textContent = `Showing ${filteredCount} of ${validAssets.length} assets`;
                searchResultsEl.classList.add('filtered');
            } else {
                searchResultsEl.textContent = 'Showing all assets';
                searchResultsEl.classList.remove('filtered');
            }
        }
        
        if (totalAssetsEl) {
            totalAssetsEl.textContent = `Total: ${validAssets.length}`;
        }
        
        if (assetCountEl) {
            assetCountEl.textContent = filteredCount;
        }
    }

    /**
     * Setup search functionality
     */
    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        if (!searchInput || !searchClear) return;
        
        // Handle search input
        searchInput.addEventListener('input', function(e) {
            searchTerm = e.target.value;
            applyFilters();
            
            // Show/hide clear button
            if (searchTerm.trim()) {
                searchClear.classList.add('show');
            } else {
                searchClear.classList.remove('show');
            }
        });
        
        // Handle clear button
        searchClear.addEventListener('click', function() {
            searchInput.value = '';
            searchTerm = '';
            searchClear.classList.remove('show');
            applyFilters();
            searchInput.focus();
        });
        
        // Handle Enter key
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    /**
     * Generate View Asset URL
     */
    function generateViewAssetUrl(gtDevice) {
        if (!currentSubdomain || !gtDevice) {
            return '#';
        }
        return `https://my.geotab.com/${currentSubdomain}/#device,id:${gtDevice}`;
    }

    /**
     * Make a Geotab API call
     */
    function makeGeotabCall(method, typeName, parameters = {}) {
        return new Promise((resolve, reject) => {
            const callParams = {
                typeName: typeName,
                ...parameters
            };
            
            api.call(method, callParams, resolve, reject);
        });
    }

    /**
     * Get AddInData entries for Ruckit mappings
     */
    async function getRuckitMappings() {
        try {
            const searchParams = {
                whereClause: 'type = "ri-device"'
            };
            
            const data = await makeGeotabCall("Get", "AddInData", { search: searchParams });
            return data || [];
        } catch (error) {
            console.error('Error fetching Ruckit mappings:', error);
            return [];
        }
    }

    /**
     * Load and display Ruckit assets data
     */
    async function loadRuckitAssets() {
        if (!api) {
            showAlert('Geotab API not initialized. Please refresh the page.', 'danger');
            return;
        }
        
        try {
            showAlert('Loading Ruckit assets...', 'info');
            
            const ruckitData = await getRuckitMappings();
            assetsData = ruckitData;
            
            // Reset search term and apply filters
            searchTerm = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }
            
            applyFilters();
            
            const validAssets = filterPlaceholderEntries(assetsData);
            
            if (validAssets.length > 0) {
                showAlert(`Successfully loaded ${validAssets.length} Ruckit assets`, 'success');
            } else {
                showAlert('No Ruckit assets found', 'info');
            }
            
        } catch (error) {
            console.error('Error loading Ruckit assets:', error);
            showAlert('Error loading Ruckit assets: ' + error.message, 'danger');
            showEmptyState();
        }
    }

    /**
     * Render the assets table
     */
    function renderAssetsTable(data) {
        const tableBody = document.getElementById('assetsTableBody');
        if (!tableBody) return;
        
        if (!data || data.length === 0) {
            if (searchTerm.trim()) {
                showNoSearchResults();
            } else {
                showEmptyState();
            }
            return;
        }
        
        const tableRows = data.map(item => {
            const details = item.details || {};
            const assetName = details.name || 'N/A';
            const ruckitDevice = details['ri-device'] || 'N/A';
            const ruckitDriver = details['ri-driver'] || 'N/A';
            const ruckitToken = details['ri-token'] || 'N/A';
            const gtDevice = details['gt-device'] || '';
            
            const viewAssetUrl = generateViewAssetUrl(gtDevice);
            const viewAssetButton = gtDevice ? 
                `<a href="${viewAssetUrl}" class="btn-view-asset" target="_blank">
                    <i class="fas fa-external-link-alt"></i>
                    View Asset
                </a>` : 
                `<span class="text-muted">No Device ID</span>`;
            
            return `
                <tr>
                    <td>
                        <i class="fas fa-truck me-2 text-primary"></i>
                        ${escapeHtml(assetName)}
                    </td>
                    <td>
                        ${escapeHtml(ruckitDevice)}
                    </td>
                    <td>
                        ${escapeHtml(ruckitDriver)}
                    </td>
                    <td>
                        ${escapeHtml(ruckitToken)}
                    </td>
                    <td>
                        ${viewAssetButton}
                    </td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = tableRows;
    }

    /**
     * Show empty state in table
     */
    function showEmptyState() {
        const tableBody = document.getElementById('assetsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h5>No Ruckit Assets Found</h5>
                        <p>No assets with Ruckit device mappings were found in the system.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Show no search results state
     */
    function showNoSearchResults() {
        const tableBody = document.getElementById('assetsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="no-search-results">
                        <i class="fas fa-search"></i>
                        <h5>No Results Found</h5>
                        <p>No assets match your search criteria. Try adjusting your search term.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Show alert messages
     */
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;
        
        const alertId = 'alert-' + Date.now();
        
        const iconMap = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}" role="alert">
                <i class="fas fa-${iconMap[type]} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert && typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Refresh data function (exposed globally)
     */
    window.refreshData = function() {
        loadRuckitAssets();
    };

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Setup search functionality
        setupSearch();
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + R to refresh data
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                loadRuckitAssets();
            }
            
            // Ctrl/Cmd + F to focus search
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        });
    }

    return {
        /**
         * initialize() is called only once when the Add-In is first loaded. Use this function to initialize the
         * Add-In's state such as default values or make API requests (MyGeotab or external) to ensure interface
         * is ready for the user.
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         * @param {function} initializeCallback - Call this when your initialize route is complete. Since your initialize routine
         *        might be doing asynchronous operations, you must call this method when the Add-In is ready
         *        for display to the user.
         */
        initialize: function (freshApi, freshState, initializeCallback) {
            api = freshApi;
            state = freshState;

            elAddin = document.getElementById('ruckitAssets');

            // Extract subdomain from current URL
            extractSubdomain();

            if (state.translate) {
                state.translate(elAddin || '');
            }
            
            initializeCallback();
        },

        /**
         * focus() is called whenever the Add-In receives focus.
         *
         * The first time the user clicks on the Add-In menu, initialize() will be called and when completed, focus().
         * focus() will be called again when the Add-In is revisited. Note that focus() will also be called whenever
         * the global state of the MyGeotab application changes, for example, if the user changes the global group
         * filter in the UI.
         *
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         */
        focus: function (freshApi, freshState) {
            api = freshApi;
            state = freshState;

            // Re-extract subdomain in case URL changed
            extractSubdomain();

            // Setup event listeners
            setupEventListeners();
            
            // Load Ruckit assets data
            loadRuckitAssets();
            
            // Show main content
            if (elAddin) {
                elAddin.style.display = 'block';
            }
        },

        /**
         * blur() is called whenever the user navigates away from the Add-In.
         *
         * Use this function to save the page state or commit changes to a data store or release memory.
         *
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         */
        blur: function () {
            // Hide main content
            if (elAddin) {
                elAddin.style.display = 'none';
            }
        }
    };
};