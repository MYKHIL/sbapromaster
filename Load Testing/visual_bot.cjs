const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50, // Slightly faster for population
        args: ['--start-maximized']
    });
    const context = await browser.newContext({
        viewport: null
    });
    const page = await context.newPage();

    console.log('🚀 Starting Visual Load Bot (Data Population & Systematic Simulation)...');

    const targetUrl = process.argv[2] || 'http://localhost:3000';
    console.log(`🔗 Target URL: ${targetUrl}`);

    // Global dialog handler
    page.on('dialog', async dialog => {
        const msg = dialog.message();
        console.log(`🔔 Dialog Alert: "${msg}"`);
        if (msg.includes('already registered') || msg.includes('expired') || msg.includes('Access')) {
            console.log('✅ Auto-dismissing blocking alert.');
        }
        await dialog.dismiss().catch(() => { });
    });

    try {
        // 1. Initial Load
        console.log('🌐 Loading App...');
        await page.goto(targetUrl);
        await page.waitForLoadState('networkidle');
        console.log('✅ App loaded.');

        const schoolName = 'SBA Academy Live';
        const password = 'password';

        // ---------------------------------------------------------
        // 2. Auth State Machine
        // ---------------------------------------------------------
        let isAuthenticated = false;
        let authRetries = 0;
        const maxAuthRetries = 40;

        console.log('🤖 Starting Auth State Machine...');

        while (!isAuthenticated && authRetries < maxAuthRetries) {
            authRetries++;
            await page.waitForTimeout(1000);

            const isWelcome = await page.getByRole('button', { name: /Login/i }).isVisible().catch(() => false);
            const isSchoolSearch = await page.getByPlaceholder(/Search schools/i).isVisible().catch(() => false);
            const isPassword = await page.getByPlaceholder(/Enter password/i).isVisible().catch(() => false) &&
                !(await page.getByText(/Admin Setup/i).isVisible().catch(() => false));
            const isYearTerm = await page.getByText(/Select Academic Period/i).isVisible().catch(() => false);
            const isRegistration = await page.getByText(/Register New School/i).isVisible().catch(() => false);
            const isUserSelection = await page.getByText(/Select Your Account/i).isVisible().catch(() => false);
            const isAdminSetup = await page.getByText(/Admin Setup/i).isVisible().catch(() => false);

            const loggedInMarker = await page.getByText(/Log Out/i).first().isVisible().catch(() => false) ||
                await page.getByText(/Welcome to SBA/i).first().isVisible().catch(() => false);

            if (loggedInMarker) {
                console.log('🎉 Authenticated!');
                isAuthenticated = true;
                break;
            }

            if (isWelcome) {
                console.log('🏠 Welcome -> Login');
                await page.getByRole('button', { name: /Login/i }).click();
            } else if (isSchoolSearch) {
                console.log(`🔍 Searching for "${schoolName}"`);
                const searchInput = page.getByPlaceholder(/Search schools/i);
                await searchInput.clear();
                await searchInput.fill(schoolName);
                await page.waitForTimeout(2000);
                const item = page.getByText(schoolName, { exact: false }).first();
                if (await item.isVisible()) {
                    await item.click();
                } else {
                    const reloadBtn = page.getByRole('button', { name: /Reload/i });
                    if (await reloadBtn.isVisible()) await reloadBtn.click();
                    if (authRetries > 10) {
                        const backBtn = page.getByRole('button', { name: /Back/i }).first();
                        if (await backBtn.isVisible()) await backBtn.click();
                        await page.waitForTimeout(1000);
                        const regBtn = page.getByRole('button', { name: /Register/i }).first();
                        if (await regBtn.isVisible()) await regBtn.click();
                    }
                }
            } else if (isPassword) {
                await page.fill('input[type="password"]', password);
                await page.click('button[type="submit"]');
            } else if (isYearTerm) {
                const firstPeriod = page.locator('button.group').first();
                if (await firstPeriod.isVisible()) await firstPeriod.click();
            } else if (isRegistration) {
                await page.fill('#schoolName', schoolName);
                await page.fill('#academicYear', '2025-2026');
                await page.selectOption('#academicTerm', 'First Term');
                await page.fill('#password', password);
                await page.fill('#confirmPassword', password);
                await page.click('button[type="submit"]');
            } else if (isUserSelection) {
                const adminBtn = page.getByText(/Admin/i).first();
                const targetBtn = (await adminBtn.isVisible()) ? adminBtn : page.getByText(/Teacher/i).first();
                if (await targetBtn.isVisible()) {
                    await targetBtn.click();
                    await page.waitForTimeout(1000);
                    const passInput = page.locator('input[type="password"]');
                    if (await passInput.isVisible()) {
                        await passInput.fill(password);
                        const confirm = page.locator('input[placeholder*="Confirm"]');
                        if (await confirm.isVisible()) await confirm.fill(password);
                        await page.click('button[type="submit"]');
                    }
                }
            } else if (isAdminSetup) {
                await page.locator('input[placeholder*="user name"]').fill('Live Admin');
                const passes = await page.$$('input[type="password"]');
                if (passes.length >= 2) {
                    await passes[0].fill(password);
                    await passes[1].fill(password);
                }
                await page.getByRole('button', { name: /Complete Setup/i }).click();
            } else {
                const restoreBtn = page.getByRole('button', { name: /Continue Session/i });
                if (await restoreBtn.isVisible()) await restoreBtn.click();
            }
        }

        if (!isAuthenticated) throw new Error('Auth failed.');

        // ---------------------------------------------------------
        // 3. Navigation & Action Helpers
        // ---------------------------------------------------------

        const navigateTo = async (pageName, retries = 2) => {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`🧭 Attempting navigation to: ${pageName} (Attempt ${i + 1})...`);

                    // 1. Check if we're already there
                    const pageHeading = await page.locator('h1, h2').first().innerText({ timeout: 3000 }).catch(() => '');
                    if (pageHeading.toLowerCase().includes(pageName.toLowerCase())) {
                        console.log(`📍 Already on ${pageName}.`);
                        return true;
                    }

                    // 2. Try to find the item in Sidebar
                    const findItem = () => page.locator('li').filter({ hasText: new RegExp(`^${pageName}$`, 'i') }).first();

                    await page.locator('aside').hover({ timeout: 2000 }).catch(() => { });
                    await page.waitForTimeout(500);

                    let item = findItem();
                    if (!(await item.isVisible())) {
                        console.log('📱 Navigation item not visible. Looking for Menu button...');
                        // Precise mobile menu detection
                        const menuBtn = page.locator('button[aria-label="Open menu"]').first();

                        if (await menuBtn.isVisible()) {
                            console.log('🔘 Mobile Menu found. Clicking...');
                            await menuBtn.click({ force: true, timeout: 5000 });
                            await page.waitForTimeout(1500); // Wait for sidebar slide-in
                        } else {
                            console.log('⚠️ Standard menu button not found. Checking alternate selectors...');
                            // Try looking for the "Menu" text or any button with a hamburger icon
                            const altMenu = page.locator('button:has-text("Menu"), button:has(svg)').first();
                            if (await altMenu.isVisible()) {
                                await altMenu.click({ force: true });
                                await page.waitForTimeout(1500);
                            }
                        }
                    }

                    item = findItem();
                    if (await item.isVisible()) {
                        await item.click({ force: true, timeout: 5000 });
                        await page.waitForTimeout(1000);

                        // Handle "Unsaved Changes"
                        const leaveBtn = page.getByRole('button', { name: /Leave Page/i });
                        if (await leaveBtn.isVisible()) {
                            await leaveBtn.click({ timeout: 3000 }).catch(() => { });
                        }

                        // Verify we actually moved
                        await page.waitForTimeout(1000);
                        const newHeading = await page.locator('h1, h2').first().innerText().catch(() => '');
                        if (newHeading.toLowerCase().includes(pageName.toLowerCase())) {
                            console.log(`✅ Successfully navigated to ${pageName}.`);
                            return true;
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ Navigation attempt ${i + 1} failed: ${e.message}`);
                }
            }
            console.error(`❌ FAILED to navigate to ${pageName} after ${retries} attempts.`);
            return false;
        };

        const triggerSave = async () => {
            console.log('💾 Triggering Global Save...');
            const expandBtn = page.locator('button[title*="Expand Controls"]').first();
            if (await expandBtn.isVisible()) await expandBtn.click();
            const saveBtn = page.getByRole('button', { name: /Save/i }).first();
            if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
                await saveBtn.click();
                await page.waitForTimeout(2000);
                return true;
            }
            return false;
        };

        const rotateSelect = async (selector) => {
            const sel = page.locator(selector).first();
            if (await sel.isVisible()) {
                const count = await sel.evaluate(s => s.options.length);
                if (count > 1) {
                    const idx = 1 + Math.floor(Math.random() * (count - 1));
                    const label = await sel.evaluate((s, i) => s.options[i].text, idx);
                    const val = await sel.evaluate((s, i) => s.options[i].value, idx);
                    await sel.selectOption(val);
                    await page.waitForTimeout(800);
                    return label;
                }
            }
            return null;
        };

        // ---------------------------------------------------------
        // 4. Data Population Phase (Threshold: 20 Teachers, 200 Students)
        // ---------------------------------------------------------

        console.log('📊 Starting Data Population Phase...');

        // 4a. Quick Check on Dashboard for Students
        await navigateTo('Dashboard');
        await page.waitForTimeout(2000); // Wait for metadata to lazy load

        let dashboardStudentCount = 0;
        const studentStat = page.locator('div:has-text("Total Students")').locator('p.text-2xl').first();
        if (await studentStat.isVisible()) {
            const text = await studentStat.innerText();
            dashboardStudentCount = parseInt(text) || 0;
            console.log(`📈 Dashboard says: ${dashboardStudentCount} students.`);
        }

        // -- Teachers (Goal: 20) --
        await navigateTo('Teachers');
        await page.waitForTimeout(1000); // Wait for data to render

        // Clear Search Filter to get accurate count
        const teacherSearch = page.getByPlaceholder(/Search classes or teachers/i);
        if (await teacherSearch.isVisible()) {
            await teacherSearch.clear();
            await page.waitForTimeout(500);
        }

        let teacherCount = await page.locator('tr.border-b.hover\\:bg-gray-50, .bg-white.p-4.rounded-xl').count();
        console.log(`👨‍🏫 Current Teachers: ${teacherCount}`);

        if (teacherCount < 20) {
            while (teacherCount < 20) {
                console.log(`➕ Adding Teacher ${teacherCount + 1}/20...`);
                await page.getByRole('button', { name: /Add New Teacher\/Class/i }).click();
                await page.fill('input[name="name"]', `Class ${String.fromCharCode(65 + (teacherCount % 26))}${Math.floor(teacherCount / 26) || ''}`);
                await page.fill('input[name="teacherName"]', `Teacher ${teacherCount + 1}`);

                // Robust submission with wait
                const submitBtn = page.locator('button[type="submit"]').first();
                if (await submitBtn.isVisible()) {
                    await submitBtn.click();
                    // Wait for modal to disappear or list to update
                    await page.waitForTimeout(1000);
                }

                teacherCount++;
                if (teacherCount % 10 === 0) await triggerSave();
                await page.waitForTimeout(200);
            }
            await triggerSave();
        } else {
            console.log('✅ Teacher threshold met. Skipping.');
        }

        // -- Students (Goal: 200) --
        if (dashboardStudentCount < 200) {
            await navigateTo('Students');
            await page.waitForTimeout(1500); // Wait for table/cards

            // Clear Search Filter
            const studentSearch = page.getByPlaceholder(/Search students/i);
            if (await studentSearch.isVisible()) {
                await studentSearch.clear();
                await page.waitForTimeout(500);
            }

            // ENSURE "All Classes" is selected to get accurate count
            const classFilter = page.locator('select').filter({ has: page.locator('option[value=""]') }).first();
            if (await classFilter.isVisible()) {
                console.log('🧹 Selecting "All Classes" for accurate counting...');
                await classFilter.selectOption('');
                await page.waitForTimeout(1000);
            }

            let studentCount = await page.locator('tr.border-b.hover\\:bg-gray-50, div.bg-white.p-4.rounded-xl.shadow-md').count();
            console.log(`🎓 Current Students (List): ${studentCount}`);

            while (studentCount < 200) {
                const batch = Math.min(10, 200 - studentCount);
                console.log(`➕ Adding batch of ${batch} students (Current: ${studentCount})...`);
                for (let i = 0; i < batch; i++) {
                    await page.getByRole('button', { name: /Add Student/i }).click();
                    await page.fill('input[name="name"]', `Student ${studentCount + 1}`);
                    const classSel = page.locator('select[name="class"]');
                    const optCount = await classSel.evaluate(s => s.options.length);
                    if (optCount > 1) await classSel.selectOption({ index: 1 + (studentCount % (optCount - 1)) });
                    await page.click('button[type="submit"]');
                    studentCount++;
                    await page.waitForTimeout(100);
                }
                await triggerSave();
                console.log(`💾 Saved batch. Total: ${studentCount}`);
            }
        } else {
            console.log('✅ Student threshold met. Skipping.');
        }

        // -- Subjects (Goal: 5) --
        await navigateTo('Subjects');
        await page.waitForTimeout(1000);
        let subjectCount = await page.locator('tr.border-b.hover\\:bg-gray-50, div.bg-white.p-4.rounded-xl.shadow-md').count();
        console.log(`📚 Current Subjects: ${subjectCount}`);

        if (subjectCount < 5) {
            const subjectsToAdd = [
                { name: 'Mathematics', type: 'Core' },
                { name: 'English Language', type: 'Core' },
                { name: 'Integrated Science', type: 'Core' },
                { name: 'Social Studies', type: 'Core' },
                { name: 'ICT', type: 'Elective' }
            ];

            for (const sub of subjectsToAdd) {
                const exists = await page.locator('td, p').filter({ hasText: new RegExp(`^${sub.name}$`, 'i') }).isVisible();
                if (!exists) {
                    console.log(`➕ Adding Subject: ${sub.name}...`);
                    await page.getByRole('button', { name: /Add New Subject/i }).click();
                    await page.fill('input[name="subject"]', sub.name);
                    await page.selectOption('select[name="type"]', sub.name === 'ICT' ? 'Elective' : 'Core');
                    await page.click('button[type="submit"]');
                    await page.waitForTimeout(500);
                }
            }
            await triggerSave();
        } else {
            console.log('✅ Subject threshold met. Skipping.');
        }

        // -- Assessment Types (Goal: 4, Total Weight: 100%) --
        await navigateTo('Assessment Types');
        await page.waitForTimeout(1000);

        const currentAssessments = await page.locator('tr.border-b, div.bg-white.p-4.rounded-xl').all();
        console.log(`📝 Current Assessment Types: ${currentAssessments.length}`);

        // If weight doesn't sum to 100 or counts are low, we reset/ensure them
        const totalWeightText = await page.locator('p:has-text("Total Weight")').innerText().catch(() => '');
        const currentTotalWeight = parseInt(totalWeightText.match(/\d+/)?.[0]) || 0;

        if (currentAssessments.length < 4 || currentTotalWeight !== 100) {
            console.log('🛠️ Resetting/Adjusting Assessment Types to reach 100%...');

            const standardLevels = [
                { name: 'Class Exercise', weight: 15 },
                { name: 'Homework', weight: 15 },
                { name: 'Project', weight: 20 },
                { name: 'End of Term Exam', weight: 50 }
            ];

            for (const level of standardLevels) {
                const exists = await page.locator('td, p').filter({ hasText: new RegExp(`^${level.name}$`, 'i') }).isVisible();
                if (!exists) {
                    console.log(`➕ Adding Assessment: ${level.name} (${level.weight}%)...`);
                    await page.getByRole('button', { name: /Add New Assessment/i }).click();
                    await page.fill('input[name="name"]', level.name);
                    await page.fill('input[name="weight"]', level.weight.toString());
                    await page.click('button[type="submit"]');
                    await page.waitForTimeout(500);
                }
            }
            await triggerSave();
        } else {
            console.log('✅ Assessment Types threshold (and 100% weight) met. Skipping.');
        }

        const getSelectOptions = async (selector) => {
            const sel = page.locator(selector).first();
            if (await sel.isVisible()) {
                return await sel.evaluate(s =>
                    Array.from(s.options)
                        .map(o => ({ value: o.value, text: o.text }))
                        .filter(o => o.value !== "")
                );
            }
            return [];
        };

        const fillUnscoredGaps = async (maxWeight) => {
            console.log('🔍 Checking for unscored students (Gap Check)...');
            const jumpBtn = page.locator('button:has-text("unscored • Tap to jump")').first();
            let jumps = 0;
            while (await jumpBtn.isVisible() && jumps < 100) {
                jumps++;
                console.log(`🎯 [Jump] Found unscored indicator. Jumping...`);
                await jumpBtn.click();
                await page.waitForTimeout(500);

                const mobileInput = page.locator('input[inputmode="decimal"]').first();
                if (await mobileInput.isVisible()) {
                    const currentVal = await mobileInput.inputValue();
                    if (!currentVal) {
                        const score = (Math.random() * (maxWeight * 0.9)).toFixed(1);
                        await mobileInput.click();
                        await page.keyboard.press('Control+A');
                        await page.keyboard.press('Backspace');
                        await page.keyboard.type(score);
                        await page.keyboard.press('Enter');
                        console.log(`✨ [Gap Fill] Entered ${score}/${maxWeight}`);
                        await page.waitForTimeout(400);
                    } else {
                        const nextBtn = page.getByRole('button', { name: /Next/i });
                        if (await nextBtn.isVisible()) await nextBtn.click();
                        await page.waitForTimeout(300);
                    }
                } else break;
            }
        };

        // ---------------------------------------------------------
        // 5. Systematic Simulation Phase
        // ---------------------------------------------------------
        console.log('⚡ Starting Systematic Score Entry Simulation...');
        await navigateTo('Score Entry');

        while (true) {
            const classes = await getSelectOptions('#class-select');
            if (classes.length === 0) {
                console.log('⚠️ No classes found. Rotating via random select...');
                await rotateSelect('#class-select');
                await page.waitForTimeout(2000);
                continue;
            }

            for (const cls of classes) {
                console.log(`\n🏫 [Systematic] Selecting Class: ${cls.text}`);
                await page.selectOption('#class-select', cls.value);
                await page.waitForTimeout(1000);

                const subjects = await getSelectOptions('#subject-select');
                for (const sub of subjects) {
                    console.log(`  📚 [Systematic] Selecting Subject: ${sub.text}`);
                    await page.selectOption('#subject-select', sub.value);
                    await page.waitForTimeout(1000);

                    // Robust View Detection
                    const mobileHeader = page.locator('.lg\\:hidden.fixed.top-0').first();
                    const isMobileView = await mobileHeader.isVisible();

                    if (isMobileView) {
                        const assessmentSelector = 'select:near(label:text-is("Assessment"))';
                        const assessments = await getSelectOptions(assessmentSelector);

                        for (const ass of assessments) {
                            console.log(`    📝 [Systematic] Selecting Assessment: ${ass.text}`);
                            await page.selectOption(assessmentSelector, ass.value);
                            await page.waitForTimeout(800);

                            // OPTIMIZATION: Check if already fully scored
                            const allScoredIndicator = page.locator('span:has-text("All students scored")').first();
                            if (await allScoredIndicator.isVisible()) {
                                console.log('    ✅ [Systematic] All students already scored. Skipping to next assessment...');
                                continue;
                            }

                            // Extract weight for capping
                            const match = ass.text.match(/\(\s*(\d+)%\s*\)/) ||
                                ass.text.match(/(\d+)%/) ||
                                ass.text.match(/\(\s*(\d+)\s*\)/);
                            const weight = match ? parseInt(match[1]) : 15;
                            const finalWeight = ass.text.toLowerCase().includes('exam') ? 100 : weight;

                            console.log(`    ⚖️ Weight: ${finalWeight}% | Filling all students...`);

                            // Select first student to start
                            const studentSelector = 'select:near(label:text-is("Student"))';
                            const students = await getSelectOptions(studentSelector);

                            for (let sIdx = 0; sIdx < students.length + 5; sIdx++) {
                                const mobileInput = page.locator('input[inputmode="decimal"]').first();
                                if (!(await mobileInput.isVisible())) break;

                                // SKIP logic: Check if empty
                                const currentVal = await mobileInput.inputValue();
                                if (!currentVal) {
                                    const score = (Math.random() * (finalWeight * 0.9)).toFixed(1);
                                    await mobileInput.click();
                                    await page.keyboard.press('Control+A');
                                    await page.keyboard.press('Backspace');
                                    await page.keyboard.type(score);
                                    await page.keyboard.press('Enter');
                                    console.log(`🎯 [Mobile] Entered ${score}/${finalWeight}`);
                                    await page.waitForTimeout(200);
                                }

                                const nextBtn = page.getByRole('button', { name: /Next/i });
                                if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
                                    await nextBtn.click();
                                    await page.waitForTimeout(400);
                                } else break;
                            }

                            // Final Gap Check (User's specific request)
                            await fillUnscoredGaps(finalWeight);
                        }
                    } else {
                        // Desktop Grid View
                        console.log('    💻 Desktop Grid: Filling missing cells systematicly...');
                        const headers = await page.locator('th').allInnerTexts();
                        const scoreColumns = headers
                            .map((h, i) => {
                                const cleanHeader = h.replace(/\n/g, ' ').trim();
                                if (cleanHeader.toLowerCase().includes('total') || cleanHeader.toLowerCase().includes('rank') || i < 2) return { index: i, weight: 0 };
                                const m = cleanHeader.match(/\(\s*(\d+)%\s*\)/) || cleanHeader.match(/(\d+)%/) || cleanHeader.match(/\(\s*(\d+)\s*\)/);
                                let w = m ? parseInt(m[1]) : 0;
                                if (cleanHeader.toLowerCase().includes('exam')) w = 100;
                                return { index: i, text: cleanHeader, weight: w };
                            })
                            .filter(h => h.weight > 0);

                        const rows = await page.locator('tbody tr').all();
                        for (const col of scoreColumns) {
                            console.log(`    🎯 Column: ${col.text} (Weight: ${col.weight})`);
                            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                                const cell = rows[rIdx].locator('td').nth(col.index);
                                const input = cell.locator('input[inputmode="decimal"]').first();
                                if (await input.isVisible()) {
                                    const currentVal = await input.inputValue();
                                    if (!currentVal) {
                                        const score = (Math.random() * (col.weight * 0.9)).toFixed(1);
                                        await input.click({ force: true });
                                        await page.keyboard.press('Control+A');
                                        await page.keyboard.press('Backspace');
                                        await page.keyboard.type(score);
                                        await page.keyboard.press('Enter');
                                    }
                                }
                                if (rIdx % 40 === 0 && rIdx > 0) await triggerSave();
                            }
                        }
                    }
                    await triggerSave();
                }
            }
            console.log('\n🔄 [Systematic] Finished full rotation. Starting over...');
            await page.waitForTimeout(5000);
        }

    } catch (e) {
        console.error('❌ Bot Error:', e);
    }
})();
