// ==UserScript==
// @name         Jira For CSEs
// @author       Ally, Rita, Dmcisneros
// @icon         https://www.liferay.com/o/classic-theme/images/favicon.ico
// @namespace    https://liferay.atlassian.net/
// @version      4.2
// @description  Jira statuses + Patcher, Account tickets and CP Link field + Internal Note highlight + Auto Expand CCC Info + Internal Request Warning
// @match        https://liferay.atlassian.net/*
// @match        https://liferay-sandbox-424.atlassian.net/*
// @updateURL    https://github.com/AllyMech14/liferay-jira-userscript/raw/refs/heads/main/userscript.js
// @downloadURL  https://github.com/AllyMech14/liferay-jira-userscript/raw/refs/heads/main/userscript.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// ==/UserScript==

(async function () {
    'use strict';

    // Map of colors by normalized status (all lowercase, spaces removed)
    const statusColors = {
        'pending': { bg: '#1378d0', color: '#e6f2fb' },
        'awaitinghelp': { bg: '#7c29a4', color: '#fff' },
        'withproductteam': { bg: '#7c29a4', color: '#fff' },
        'withsre': { bg: '#7c29a4', color: '#fff' },
        'inprogress': { bg: '#cc2d24', color: '#fff' },

        // unchanged statuses below
        'solutionproposed': { bg: '#7d868e', color: '#fff' },
        'solutionaccepted': { bg: '#28a745', color: '#fff' },
        'closed': { bg: '#dddee1', color: '#000' },
        'inactive': { bg: '#FFEB3B', color: '#000' },
        'new': { bg: '#FFEB3B', color: '#000' }
    };

    // Normalize any status text (remove spaces, punctuation, lowercase)
    function normalizeStatus(text) {
        return text
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z]/g, '')
            .toLowerCase();
    }

    // Apply colors dynamically
    function applyColors() {
        const elements = document.querySelectorAll(
            '._bfhk1ymo,' +
            '.jira-issue-status-lozenge,' +
            '[data-testid*="status-lozenge"],' +
            'span[title],' +
            'div[aria-label*="Status"],' +
            '[data-testid*="issue-status"] span,' +
            '.css-1mh9skp,' +
            '.css-14er0c4,' +
            '.css-1ei6h1c'
        );

        elements.forEach(el => {
            const rawText = (el.innerText || el.textContent || '').trim();
            const key = normalizeStatus(rawText);
            const style = statusColors[key];

            el.style.padding = '3px 4px';
            el.style.fontSize = '1em';
            el.style.borderRadius = '4px';
            el.style.minHeight = '13px';
            el.style.minWidth = '24px';
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.lineHeight = '1';
            el.style.boxSizing = 'border-box';
            el.style.backgroundImage = 'none';
            el.style.boxShadow = 'none';

            if (style) {
                el.style.setProperty("background", style.bg, "important");
                el.style.setProperty("color", style.color, "important");
                el.style.setProperty("font-weight", "bold", "important");
                el.style.setProperty("border", "none", "important");
            }
            el.querySelectorAll('span').forEach(span => {
                span.style.setProperty("background", "transparent", "important");
                span.style.setProperty("color", "inherit", "important");
                span.style.setProperty("font-size", "1em", "important");
            });
        });
    }

    function getTicketType() {
        const title = document.title;
        const match = title.match(/\[([A-Z]+)-\d+\]/);
        return match ? match[1] : null;
    }

    /*********** INTERNAL REQUEST TOP BAR WARNING ***********/

    function isInternalRequest() {
        // 1. Check Project
        const project = getTicketType();
        if (project !== 'LRHC') return false;

        // 2. Locate the Request Type field using the ID from your snippet (customfield_10010)
        // This targets the specific wrapper shown in your HTML
        const requestTypeElement = document.querySelector('[data-testid*="customfield_10010"]');

        // 3. Fallback: If for some reason the ID changes, look for the 'aria-label' on the edit button
        // Your snippet shows: aria-label="Edit Request Type, Internal Request selected, edit"
        const requestTypeButton = document.querySelector('button[aria-label*="Request Type"]');

        let textToCheck = "";

        if (requestTypeElement) {
            textToCheck = requestTypeElement.textContent || "";
        } else if (requestTypeButton) {
            textToCheck = requestTypeButton.getAttribute('aria-label') || "";
        }

        // 4. Check if "Internal Request" is present in the text
        return textToCheck.includes("Internal Request");
    }

    function checkInternalRequestWarning() {
        const existingWarning = document.getElementById('internal-request-warning-bar');
        const showWarning = isInternalRequest();

        if (showWarning) {
            if (existingWarning) return; // Already showing

            const warningBar = document.createElement('div');
            warningBar.id = 'internal-request-warning-bar';
            warningBar.style.cssText = `
                background-color: #FFAB00; /* Standard Warning Yellow */
                color: #172B4D;            /* Standard Dark Text */
                text-align: center;
                padding: 10px;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                z-index: 9999;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;

            const linkUrl = "https://liferay.atlassian.net/wiki/spaces/SUPPORT/pages/4096557057/JSM+Agent+Overview#How-To-Publish-an-Internal-Request-to-customers";
            warningBar.innerHTML = `
                ⚠️ Manually changing the request type to General Request <b>will not publish the ticket by itself</b>.
                To avoid issues, always use the <b>Publish to Customer automation</b>.
                <a href="${linkUrl}" target="_blank" style="color: #0052CC; text-decoration: underline; margin-left: 5px;">More info.</a>
            `;

            document.body.prepend(warningBar);
            document.body.style.paddingTop = '40px';
        } else {
            // Remove warning if conditions are no longer met
            if (existingWarning) {
                existingWarning.remove();
                document.body.style.paddingTop = '0px';
            }
        }
    }

    /*********** JIRA FILTER LINK FIELD ***********/

    function getJiraFilterHref(accountCode) {
        if (!accountCode) return null;
        const jiraFilterByAccountCode = 'https://liferay.atlassian.net/issues/?jql=%22account%20code%5Bshort%20text%5D%22%20~%20%22<CODE>%22%20and%20project%20%3D%20LRHC%20ORDER%20BY%20created%20DESC';
        return jiraFilterByAccountCode.replace('<CODE>', accountCode);
    }

    function createJiraFilterLinkField() {
        const originalField = document.querySelector('[data-component-selector="jira-issue-field-heading-field-wrapper"]');
        if (!originalField) return;
        const referenceField = document.querySelector('.patcher-link-field');
        if (!referenceField) return;
        if (document.querySelector('.jira-filter-link-field')) return;

        const accountCode = getAccountCode();
        const clone = originalField.cloneNode(true);
        clone.querySelector('[data-testid="issue-view-layout-assignee-field.ui.assign-to-me"]')?.remove();
        clone.classList.add('jira-filter-link-field');
        const heading = clone.querySelector('h3');
        if (heading) heading.textContent = 'Account Filter';

        const contentContainer = clone.querySelector('[data-testid="issue-field-inline-edit-read-view-container.ui.container"]');
        if (contentContainer) contentContainer.innerHTML = '';

        const link = document.createElement('a');
        if (accountCode) {
            link.href = getJiraFilterHref(accountCode);
            link.target = '_blank';
            link.textContent = accountCode;
        } else {
            link.textContent = 'Account Code Missing';
            link.style.color = '#999';
        }

        link.style.display = 'block';
        link.style.marginTop = '5px';
        link.style.textDecoration = 'underline';
        contentContainer?.appendChild(link);
        referenceField.parentNode.insertBefore(clone, referenceField.nextSibling);
    }

    /*********** PATCHER LINK FIELD ***********/
    function getPatcherPortalAccountsHREF(path, params) {
        const portletId = '1_WAR_osbpatcherportlet';
        const ns = '_' + portletId + '_';
        const queryString = Object.keys(params)
            .map(key => (key.startsWith('p_p_') ? key : ns + key) + '=' + encodeURIComponent(params[key]))
            .join('&');
        return 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/accounts' + path + '?p_p_id=' + portletId + '&' + queryString;
    }

    function getAccountCode() {
        const accountDiv = document.querySelector('[data-testid="issue.views.field.single-line-text.read-view.customfield_12570"]');
        return accountDiv ? accountDiv.textContent.trim() : null;
    }

    function createPatcherField() {
        const ticketType = getTicketType();
        if (!['LRHC', 'LRFLS'].includes(ticketType)) return;

        const originalField = document.querySelector('[data-component-selector="jira-issue-field-heading-field-wrapper"]');
        if (!originalField) return;
        if (document.querySelector('.patcher-link-field')) return;

        const accountCode = getAccountCode();
        const clone = originalField.cloneNode(true);
        const assignToMe = clone.querySelector('[data-testid="issue-view-layout-assignee-field.ui.assign-to-me"]');
        if (assignToMe) assignToMe.remove();
        clone.classList.add('patcher-link-field');

        const heading = clone.querySelector('h3');
        if (heading) heading.textContent = 'Patcher Link';

        const contentContainer = clone.querySelector('[data-testid="issue-field-inline-edit-read-view-container.ui.container"]');
        if (contentContainer) contentContainer.innerHTML = '';

        const link = document.createElement('a');
        if (accountCode) {
            link.href = getPatcherPortalAccountsHREF('', { accountEntryCode: accountCode });
            link.target = '_blank';
            link.textContent = accountCode;
        } else {
            link.textContent = 'Account Code Missing';
            link.style.color = '#999';
        }

        link.style.display = 'block';
        link.style.marginTop = '5px';
        link.style.textDecoration = 'underline';
        contentContainer && contentContainer.appendChild(link);
        originalField.parentNode.insertBefore(clone, originalField.nextSibling);
    }

    /*********** CUSTOMER PORTAL LINK FIELD ***********/
    const customerPortalCache = { issueKey: null, assetInfo: null, externalKey: null, promise: null };

    function getIssueKey() {
        const url = window.location.href;
        const match = url.match(/[A-Z]+-\d+/g);
        return match ? match[match.length - 1] : null;
    }

    async function fetchAssetInfo(issueKey) {
        const apiUrl = `/rest/api/3/issue/${issueKey}?fields=customfield_12557`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`API failed (${res.status})`);
        const data = await res.json();
        const field = data.fields.customfield_12557?.[0];
        if (!field) throw new Error('Asset missing');
        return { workspaceId: field.workspaceId, objectId: field.objectId };
    }

    async function fetchExternalKey(workspaceId, objectId) {
        const url = `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/object/${objectId}?includeExtendedInfo=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gateway failed (${res.status})`);
        const data = await res.json();
        const extAttr = data.attributes.find(attr => attr.objectTypeAttribute.name === 'External Key');
        if (!extAttr || !extAttr.objectAttributeValues.length) throw new Error('No External Key');
        return extAttr.objectAttributeValues[0].value;
    }

    async function fetchCustomerPortalData(issueKey) {
        if (customerPortalCache.issueKey === issueKey && customerPortalCache.externalKey) return customerPortalCache.externalKey;
        if (customerPortalCache.issueKey !== issueKey) {
            customerPortalCache.issueKey = issueKey;
            customerPortalCache.externalKey = null;
            customerPortalCache.promise = null;
        }
        if (customerPortalCache.promise) return customerPortalCache.promise;

        customerPortalCache.promise = (async () => {
            try {
                const assetInfo = await fetchAssetInfo(issueKey);
                return await fetchExternalKey(assetInfo.workspaceId, assetInfo.objectId);
            } catch (error) {
                customerPortalCache.promise = null;
                throw error;
            }
        })();
        return customerPortalCache.promise;
    }

    async function createCustomerPortalField() {
        const ticketType = getTicketType();
        if (!['LRHC', 'LRFLS'].includes(ticketType)) return;

        const originalField = document.querySelector('[data-component-selector="jira-issue-field-heading-field-wrapper"]');
        if (!originalField || document.querySelector('.customer-portal-link-field')) return;

        const issueKey = getIssueKey();
        if (!issueKey) return;

        const clone = originalField.cloneNode(true);
        clone.querySelector('[data-testid="issue-view-layout-assignee-field.ui.assign-to-me"]')?.remove();
        clone.classList.add('customer-portal-link-field');
        const heading = clone.querySelector('h3');
        if (heading) heading.textContent = 'Customer Portal';

        const contentContainer = clone.querySelector('[data-testid="issue-field-inline-edit-read-view-container.ui.container"]');
        if (contentContainer) contentContainer.innerHTML = '';

        const statusText = document.createElement('span');
        statusText.textContent = 'Loading Portal Link...';
        statusText.style.color = '#FFA500';
        contentContainer?.appendChild(statusText);
        originalField.parentNode.insertBefore(clone, originalField.nextSibling);

        try {
            const externalKey = await fetchCustomerPortalData(issueKey);
            contentContainer.innerHTML = '';
            const link = document.createElement('a');
            link.href = `https://support.liferay.com/project/#/${externalKey}`;
            link.target = '_blank';
            link.textContent = externalKey;
            link.style.cssText = 'display: block; margin-top: 5px; text-decoration: underline;';
            contentContainer.appendChild(link);
        } catch (error) {
            statusText.textContent = 'Link Not Found';
            statusText.style.color = '#DC143C';
        }
    }

    /*********** INTERNAL NOTE HIGHLIGHT ***********/
    function highlightEditor() {
        const editorWrapper = document.querySelector('.css-sox1a6');
        const editor = document.querySelector('#ak-editor-textarea');
        const internalNoteButton = document.querySelector('#comment-editor-container-tabs-0');
        const isInternalSelected = internalNoteButton && internalNoteButton.getAttribute('aria-selected') === 'true';

        if (isInternalSelected) {
            if (editorWrapper) {
                editorWrapper.style.setProperty('background-color', '#FFFACD', 'important');
                editorWrapper.style.setProperty('border', '2px solid #FFD700', 'important');
                editorWrapper.style.setProperty('color', '#000000', 'important');
            }
            if (editor) editor.style.setProperty('background-color', '#FFFACD', 'important');
        } else {
            if (editorWrapper) {
                editorWrapper.style.removeProperty('background-color');
                editorWrapper.style.removeProperty('border');
            }
            if (editor) editor.style.removeProperty('background-color');
        }
    }

    /*********** NEW FEATURE: HIGH PRIORITY FLAME ICON ***********/
    function addFlameIconToHighPriority() {
        const highPrioritySelectors = ['img[src*="high_new.svg"]', 'img[src*="avatar/10635"]'].join(', ');
        const highPriorityIcons = document.querySelectorAll(highPrioritySelectors);

        highPriorityIcons.forEach(icon => {
            if (icon.closest('.flame-icon-wrapper')) return;
            const flameIcon = document.createElement('span');
            flameIcon.textContent = '🔥';
            flameIcon.style.cssText = 'font-size: 16px; margin-left: 5px; vertical-align: middle; display: inline-block;';
            const wrapper = document.createElement('span');
            wrapper.classList.add('flame-icon-wrapper');
            wrapper.style.display = 'inline-flex';
            wrapper.style.alignItems = 'center';
            const parent = icon.parentNode;
            wrapper.appendChild(icon.cloneNode(true));
            wrapper.appendChild(flameIcon);
            parent.replaceChild(wrapper, icon);
        });
    }

    /*********** EXPAND CCC INFO ***********/
    function expandCCCInfo() {
        const targetHeaders = ["CCC Account Info", "CCC Infrastructure Info", "CCC SaaS Maintenance Info"];
        const allHeaders = Array.from(document.querySelectorAll('h3'));
        const allCards = document.querySelectorAll('[data-testid="issue-field-cmdb-object-lazy.ui.card.cmdb-object-card"]');

        allCards.forEach(card => {
            const precedingHeaders = allHeaders.filter(h => (h.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
            const nearestHeader = precedingHeaders.length > 0 ? precedingHeaders[precedingHeaders.length - 1] : null;
            if (nearestHeader && targetHeaders.includes(nearestHeader.textContent.trim())) {
                const buttons = card.querySelectorAll('button');
                buttons.forEach(btn => {
                    const testId = btn.getAttribute('data-testid') || "";
                    if (!testId.includes('button-view-details') && !testId.includes('button-edit') && !btn.hasAttribute('data-userscript-auto-expanded')) {
                        btn.click();
                        btn.setAttribute('data-userscript-auto-expanded', 'true');
                    }
                });
            }
        });
        setTimeout(transformLinks, 500);
    }

    function transformLinks() {
        const targetDiv = document.querySelector('div[data-testid="insight-attribute-list-text-attribute-text"]');
        if (targetDiv) {
            targetDiv.style.whiteSpace = 'pre-wrap';
            const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
            targetDiv.innerHTML = targetDiv.textContent.replace(urlRegex, (url) => {
                let href = url.match(/^https?:\/\//i) ? url : 'http://' + url;
                return `<a href="${href}" target="_blank">${url}</a>`;
            });
        }
    }

    /*********** TOGGLE MENU ***********/
    const S = {
        disableShortcuts: GM_getValue("disableShortcuts", false),
        bgTabOpen: GM_getValue("bgTabOpen", false),
    };

    function registerMenu() {
        GM_registerMenuCommand(`Disable Jira Shortcuts: ${S.disableShortcuts ? "ON" : "OFF"}`, () => toggleSetting("disableShortcuts"));
        GM_registerMenuCommand(`Open Tickets in New Tab: ${S.bgTabOpen ? "ON" : "OFF"}`, () => toggleSetting("bgTabOpen"));
    }

    function toggleSetting(key) {
        S[key] = !S[key];
        GM_setValue(key, S[key]);
        alert(`Toggled ${key} → ${S[key] ? "ON" : "OFF"}.\nReload Jira.`);
    }

    function backgroundTabLinks() {
        if (!S.bgTabOpen) return;
        document.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link?.href && /\/browse\/[A-Z0-9]+-\d+/i.test(link.href) && !e.ctrlKey && !e.metaKey && e.button === 0) {
                e.stopImmediatePropagation();
                e.preventDefault();
                window.open(link.href, "_blank");
            }
        }, true);
    }

    function disableShortcuts() {
        if (!S.disableShortcuts) return;
        window.addEventListener('keydown', (e) => {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) e.stopImmediatePropagation();
        }, true);
    }

    /*********** INITIAL RUN + OBSERVERS ***********/
    async function updateUI() {
        applyColors();
        createPatcherField();
        createJiraFilterLinkField();
        highlightEditor();
        checkInternalRequestWarning(); // NEW logic
        await createCustomerPortalField();
        addFlameIconToHighPriority();
        expandCCCInfo();
    }

    await updateUI();
    registerMenu();
    disableShortcuts();
    backgroundTabLinks();

    const observer = new MutationObserver(updateUI);
    observer.observe(document.body, { childList: true, subtree: true });

})();