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
    let allDevicesData = [];
    let filteredAllDevices = [];
    let searchTermAll = '';
    let searchTermRuckit = '';
    let editingDeviceId = null;

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
     * Load and display all data
     */
    async function loadRuckitAssets() {
        if (!api) {
            showAlert('Geotab API not initialized. Please refresh the page.', 'danger');
            return;
        }
        
        try {
            showAlert('Loading assets...', 'info');
            
            // Load all devices
            allDevicesData = await getAllDevices();
            
            // Load Ruckit mappings
            const ruckitData = await getRuckitMappings();
            assetsData = ruckitData;
            
            // Reset search terms
            searchTermAll = '';
            searchTermRuckit = '';
            
            const searchInputAll = document.getElementById('searchInputAll');
            const searchInputRuckit = document.getElementById('searchInputRuckit');
            
            if (searchInputAll) searchInputAll.value = '';
            if (searchInputRuckit) searchInputRuckit.value = '';
            
            // Apply filters and render
            applyAllDevicesFilters();
            applyFilters();
            
            const validAssets = filterPlaceholderEntries(assetsData);
            showAlert(`Loaded ${allDevicesData.length} total assets, ${validAssets.length} with Ruckit credentials`, 'success');
            
        } catch (error) {
            console.error('Error loading assets:', error);
            showAlert('Error loading assets: ' + error.message, 'danger');
        }
    }

    /**
     * Render all devices table (left column)
     */
    function renderAllDevicesTable(data) {
        const tableBody = document.getElementById('allAssetsTableBody');
        if (!tableBody) return;
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="2">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h5>No Assets Found</h5>
                            <p>No assets found in the system.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const tableRows = data.map(device => {
            const deviceId = device.id;
            const deviceName = device.name || 'N/A';
            const existingMapping = findExistingMappingForDevice(deviceId);
            const hasCredentials = existingMapping && 
                                existingMapping.details['ri-token'] !== 'TOKEN' &&
                                existingMapping.details['ri-device'] !== 'DeviceID';
            
            return `
                <tr data-device-id="${deviceId}">
                    <td>
                        <i class="fas fa-truck me-2 text-primary"></i>
                        ${escapeHtml(deviceName)}
                        ${hasCredentials ? '<span class="badge bg-success ms-2">Has Credentials</span>' : ''}
                    </td>
                    <td>
                        <button class="btn-add-credentials" onclick="showCredentialForm('${deviceId}', '${escapeHtml(deviceName)}', ${existingMapping ? 'true' : 'false'})">
                            <i class="fas fa-plus me-1"></i>${hasCredentials ? 'Edit' : 'Add'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = tableRows;
    }

    /**
     * Render the assets table
     */
    function renderAssetsTable(data) {
        const tableBody = document.getElementById('ruckitAssetsTableBody');
        if (!tableBody) return;
        
        if (!data || data.length === 0) {
            if (searchTermRuckit.trim()) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="no-search-results">
                                <i class="fas fa-search"></i>
                                <h5>No Results Found</h5>
                                <p>No assets match your search criteria.</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fas fa-inbox"></i>
                                <h5>No Ruckit Assets Found</h5>
                                <p>No assets with Ruckit credentials yet.</p>
                            </div>
                        </td>
                    </tr>
                `;
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
            
            return `
                <tr>
                    <td>
                        <i class="fas fa-truck me-2 text-primary"></i>
                        ${escapeHtml(assetName)}
                    </td>
                    <td>${escapeHtml(ruckitDevice)}</td>
                    <td>${escapeHtml(ruckitDriver)}</td>
                    <td>${escapeHtml(ruckitToken)}</td>
                    <td>
                        <button class="btn-edit-credentials" onclick="showCredentialForm('${gtDevice}', '${escapeHtml(assetName)}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-clear-credentials" onclick="clearCredentials('${gtDevice}', '${escapeHtml(assetName)}')">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                        ${gtDevice ? `<a href="${viewAssetUrl}" class="btn-view-asset" target="_blank">
                            <i class="fas fa-external-link-alt"></i> View
                        </a>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = tableRows;
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

    /**
     * Get all devices from Geotab
     */
    async function getAllDevices() {
        try {
            const devices = await makeGeotabCall("Get", "Device", {});
            return devices || [];
        } catch (error) {
            console.error('Error fetching all devices:', error);
            return [];
        }
    }

    /**
     * Filter data for all devices column
     */
    function filterAllDevicesBySearch(data, searchTerm) {
        if (!searchTerm.trim()) {
            return data;
        }
        
        const term = searchTerm.toLowerCase().trim();
        return data.filter(device => {
            const deviceName = (device.name || '').toLowerCase();
            return deviceName.includes(term);
        });
    }

    /**
     * Apply filters to all devices
     */
    function applyAllDevicesFilters() {
        filteredAllDevices = filterAllDevicesBySearch(allDevicesData, searchTermAll);
        renderAllDevicesTable(filteredAllDevices);
        updateAllDevicesSearchStats();
    }

    /**
     * Apply filters to Ruckit assets
     */
    function applyFilters() {
        let filtered = filterPlaceholderEntries(assetsData);
        filtered = filterDataBySearch(filtered, searchTermRuckit);
        
        filteredData = filtered;
        renderAssetsTable(filteredData);
        updateSearchStats();
    }

    /**
     * Update search statistics for all devices
     */
    function updateAllDevicesSearchStats() {
        const searchResultsEl = document.getElementById('searchResultsAll');
        const totalAssetsEl = document.getElementById('totalAssetsAll');
        const assetCountEl = document.getElementById('assetCountAll');
        
        const filteredCount = filteredAllDevices.length;
        const totalCount = allDevicesData.length;
        
        if (searchResultsEl) {
            if (searchTermAll.trim()) {
                searchResultsEl.textContent = `Showing ${filteredCount} of ${totalCount} assets`;
                searchResultsEl.classList.add('filtered');
            } else {
                searchResultsEl.textContent = 'Showing all assets';
                searchResultsEl.classList.remove('filtered');
            }
        }
        
        if (totalAssetsEl) {
            totalAssetsEl.textContent = `Total: ${totalCount}`;
        }
        
        if (assetCountEl) {
            assetCountEl.textContent = filteredCount;
        }
    }

    /**
     * Update search statistics for Ruckit assets
     */
    function updateSearchStats() {
        const searchResultsEl = document.getElementById('searchResultsRuckit');
        const totalAssetsEl = document.getElementById('totalAssetsRuckit');
        const assetCountEl = document.getElementById('assetCountRuckit');
        
        const validAssets = filterPlaceholderEntries(assetsData);
        const filteredCount = filteredData.length;
        
        if (searchResultsEl) {
            if (searchTermRuckit.trim()) {
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
     * Setup search functionality for both columns
     */
    function setupSearch() {
        // All devices search
        const searchInputAll = document.getElementById('searchInputAll');
        const searchClearAll = document.getElementById('searchClearAll');
        
        if (searchInputAll && searchClearAll) {
            searchInputAll.addEventListener('input', function(e) {
                searchTermAll = e.target.value;
                applyAllDevicesFilters();
                
                if (searchTermAll.trim()) {
                    searchClearAll.classList.add('show');
                } else {
                    searchClearAll.classList.remove('show');
                }
            });
            
            searchClearAll.addEventListener('click', function() {
                searchInputAll.value = '';
                searchTermAll = '';
                searchClearAll.classList.remove('show');
                applyAllDevicesFilters();
                searchInputAll.focus();
            });
        }
        
        // Ruckit assets search
        const searchInputRuckit = document.getElementById('searchInputRuckit');
        const searchClearRuckit = document.getElementById('searchClearRuckit');
        
        if (searchInputRuckit && searchClearRuckit) {
            searchInputRuckit.addEventListener('input', function(e) {
                searchTermRuckit = e.target.value;
                applyFilters();
                
                if (searchTermRuckit.trim()) {
                    searchClearRuckit.classList.add('show');
                } else {
                    searchClearRuckit.classList.remove('show');
                }
            });
            
            searchClearRuckit.addEventListener('click', function() {
                searchInputRuckit.value = '';
                searchTermRuckit = '';
                searchClearRuckit.classList.remove('show');
                applyFilters();
                searchInputRuckit.focus();
            });
        }
    }

    /**
     * Find existing mapping for a device
     */
    function findExistingMappingForDevice(deviceId) {
        return assetsData.find(mapping => 
            mapping.details && 
            mapping.details['gt-device'] === deviceId
        ) || null;
    }

    /**
     * Show inline credential form
     */
    function showCredentialForm(deviceId, deviceName, existingMapping = null) {
        editingDeviceId = deviceId;
        
        const defaultToken = existingMapping?.details?.['ri-token'] || '';
        const defaultDevice = existingMapping?.details?.['ri-device'] || '';
        const defaultDriver = existingMapping?.details?.['ri-driver'] || '';
        
        const formHtml = `
            <tr id="credential-form-row-${deviceId}">
                <td colspan="2">
                    <div class="credential-form">
                        <div class="credential-form-group">
                            <label>Ruckit Token:</label>
                            <input type="text" id="token-${deviceId}" value="${escapeHtml(defaultToken)}" placeholder="Enter token">
                        </div>
                        <div class="credential-form-group">
                            <label>Ruckit Device ID:</label>
                            <input type="text" id="device-${deviceId}" value="${escapeHtml(defaultDevice)}" placeholder="Enter device ID">
                        </div>
                        <div class="credential-form-group">
                            <label>Ruckit Driver ID:</label>
                            <input type="text" id="driver-${deviceId}" value="${escapeHtml(defaultDriver)}" placeholder="Enter driver ID">
                        </div>
                        <div class="credential-form-actions">
                            <button class="btn-credential btn-credential-cancel" onclick="cancelCredentialForm('${deviceId}')">
                                Cancel
                            </button>
                            <button class="btn-credential btn-credential-save" onclick="saveCredentials('${deviceId}', '${escapeHtml(deviceName)}')">
                                Save
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        
        // Find the device row and insert form after it
        const deviceRow = document.querySelector(`tr[data-device-id="${deviceId}"]`);
        if (deviceRow) {
            // Remove any existing form
            const existingForm = document.getElementById(`credential-form-row-${deviceId}`);
            if (existingForm) {
                existingForm.remove();
            }
            
            deviceRow.insertAdjacentHTML('afterend', formHtml);
        }
    }

    /**
     * Cancel credential form
     */
    window.cancelCredentialForm = function(deviceId) {
        const formRow = document.getElementById(`credential-form-row-${deviceId}`);
        if (formRow) {
            formRow.remove();
        }
        editingDeviceId = null;
    };

    /**
     * Validate credentials are not already in use
     */
    async function validateCredentials(token, device, driver, currentDeviceId) {
        try {
            for (const mapping of assetsData) {
                if (!mapping.details) continue;
                
                const gtDevice = mapping.details['gt-device'];
                
                // Skip the current device's mapping
                if (gtDevice === currentDeviceId) continue;
                
                const existingToken = mapping.details['ri-token'];
                const existingDevice = mapping.details['ri-device'];
                const existingDriver = mapping.details['ri-driver'];
                const deviceName = mapping.details['name'] || 'Unknown Device';
                
                // Skip placeholder values
                if (existingToken === 'TOKEN' || existingDevice === 'DeviceID' || existingDriver === 'DriverID') {
                    continue;
                }
                
                if (existingToken === token) {
                    return `Token "${token}" is already in use by device "${deviceName}"`;
                }
                
                if (existingDevice === device) {
                    return `Device ID "${device}" is already in use by device "${deviceName}"`;
                }
                
                if (existingDriver === driver) {
                    return `Driver ID "${driver}" is already in use by device "${deviceName}"`;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error validating credentials:', error);
            return 'Error validating credentials';
        }
    }

    /**
     * Save credentials
     */
    window.saveCredentials = async function(deviceId, deviceName) {
        const tokenInput = document.getElementById(`token-${deviceId}`);
        const deviceInput = document.getElementById(`device-${deviceId}`);
        const driverInput = document.getElementById(`driver-${deviceId}`);
        
        const token = tokenInput.value.trim();
        const device = deviceInput.value.trim();
        const driver = driverInput.value.trim();
        
        if (!token || !device || !driver) {
            showAlert('Please fill in all fields', 'danger');
            return;
        }
        
        if (token === 'TOKEN' || device === 'DeviceID' || driver === 'DriverID') {
            showAlert('Please enter actual values, not default placeholders', 'danger');
            return;
        }
        
        try {
            // Validate credentials
            const validationError = await validateCredentials(token, device, driver, deviceId);
            if (validationError) {
                showAlert(validationError, 'danger');
                return;
            }
            
            // Get device info for serial number
            const devices = await makeGeotabCall("Get", "Device", { search: { id: deviceId } });
            const serialNumber = devices && devices[0] ? devices[0].serialNumber : '';
            
            const existingMapping = findExistingMappingForDevice(deviceId);
            
            const mappingData = {
                addInId: "aTMyNTA4NjktMzIxOC02YTQ",
                details: {
                    'date': new Date().toISOString(),
                    'gt-device': deviceId,
                    'name': deviceName,
                    'gt-sn': serialNumber,
                    'ri-token': token,
                    'ri-device': device,
                    'ri-driver': driver,
                    'type': 'ri-device'
                },
                id: null
            };
            
            if (existingMapping) {
                mappingData.id = existingMapping.id;
                mappingData.version = existingMapping.version;
                await makeGeotabCall("Set", "AddInData", { entity: mappingData });
            } else {
                await makeGeotabCall("Add", "AddInData", { entity: mappingData });
            }
            
            showAlert('Credentials saved successfully!', 'success');
            cancelCredentialForm(deviceId);
            
            // Reload data
            await loadRuckitAssets();
            
        } catch (error) {
            console.error('Error saving credentials:', error);
            showAlert('Error saving credentials: ' + error.message, 'danger');
        }
    };

    /**
     * Clear credentials
     */
    window.clearCredentials = async function(deviceId, deviceName) {
        if (!confirm(`Are you sure you want to clear Ruckit credentials for ${deviceName}?`)) {
            return;
        }
        
        try {
            const existingMapping = findExistingMappingForDevice(deviceId);
            
            if (!existingMapping) {
                showAlert('No mapping found to clear', 'info');
                return;
            }
            
            const devices = await makeGeotabCall("Get", "Device", { search: { id: deviceId } });
            const serialNumber = devices && devices[0] ? devices[0].serialNumber : '';
            
            const mappingData = {
                addInId: "aTMyNTA4NjktMzIxOC02YTQ",
                details: {
                    'date': new Date().toISOString(),
                    'gt-device': deviceId,
                    'name': deviceName,
                    'gt-sn': serialNumber,
                    'ri-token': 'TOKEN',
                    'ri-device': 'DeviceID',
                    'ri-driver': 'DriverID',
                    'type': 'ri-device'
                },
                id: existingMapping.id,
                version: existingMapping.version
            };
            
            await makeGeotabCall("Set", "AddInData", { entity: mappingData });
            
            showAlert('Credentials cleared successfully!', 'success');
            
            // Reload data
            await loadRuckitAssets();
            
        } catch (error) {
            console.error('Error clearing credentials:', error);
            showAlert('Error clearing credentials: ' + error.message, 'danger');
        }
    };

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