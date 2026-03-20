/**
 * Verification Script for Score Validation Logic
 */

function validateScore(rawInput, assessmentWeight, isExam = false) {
    const maxScore = isExam ? 100 : assessmentWeight;
    const basis = isExam ? 100 : assessmentWeight;

    let convertedScore;
    if (rawInput.includes('/')) {
        const parts = rawInput.split('/');
        if (parts.length !== 2) return { valid: false, error: "Use 'x' or 'x/y'" };
        const [x, y] = parts.map(Number);
        if (isNaN(x) || isNaN(y) || y === 0) return { valid: false, error: "Invalid fraction" };
        convertedScore = (x / y) * maxScore;
    } else {
        const z = Number(rawInput);
        if (isNaN(z)) return { valid: false, error: "Numbers only" };
        convertedScore = z;
    }

    if (convertedScore / basis > 1 || convertedScore < 0) {
        return { 
            valid: false, 
            error: "Score cannot exceed assessment weight (max 100%)",
            normalizedValue: convertedScore / basis
        };
    }

    return { 
        valid: true, 
        finalScore: `${Number(convertedScore.toFixed(1))}/${basis}` 
    };
}

const testCases = [
    { input: "10", weight: 10, exam: false, expected: true },
    { input: "109", weight: 10, exam: false, expected: false },
    { input: "11/10", weight: 10, exam: false, expected: false },
    { input: "5/10", weight: 10, exam: false, expected: true },
    { input: "10/10", weight: 10, exam: false, expected: true },
    { input: "100", weight: 30, exam: true, expected: true },
    { input: "101", weight: 30, exam: true, expected: false },
    { input: "30/100", weight: 30, exam: true, expected: true },
    { input: "110/100", weight: 30, exam: true, expected: false },
];

console.log("--- Score Validation Test Results ---");
let failures = 0;
testCases.forEach((tc, i) => {
    const result = validateScore(tc.input, tc.weight, tc.exam);
    const pass = result.valid === tc.expected;
    console.log(`Test ${i+1}: Input="${tc.input}", Weight=${tc.weight}, Exam=${tc.exam} -> ${result.valid ? 'VALID' : 'INVALID'}`);
    if (result.error) console.log(`   Error: ${result.error}`);
    if (!pass) {
        console.error(`   ❌ FAILED: Expected ${tc.expected ? 'VALID' : 'INVALID'}`);
        failures++;
    }
});

if (failures > 0) {
    console.error(`\n--- FAILED: ${failures} test cases failed ---`);
    process.exit(1);
} else {
    console.log(`\n--- PASSED: All test cases passed ---`);
}
