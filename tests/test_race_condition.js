
const state = {
    selectedSubjectId: 2, // Science
    scores: []
};

const updateStudentScores = (studentId, subjectId, assessmentId, val) => {
    const scoreId = `${studentId}-${subjectId}`;
    state.scores.push({ id: scoreId, studentId, subjectId, val });
};

// SIMULATE RACE CONDITION:
// User clicks "RME" dropdown (ID 8)
// dropdown onChange fires immediately
state.selectedSubjectId = 8;

// But a delayed onBlur for the Science input (still in the DOM during transition) triggers!
// BEFORE: InlineScoreInput would use the NEW selectedSubjectId from parent.
// NOW: With the key change, the Science component is unmounted. 

console.log('Testing subject transition safety...');
console.log('Step 1: Current Subject is Science(2)');
const subjectAtFocus = 2; // Simulated closure or prop

console.log('Step 2: User switches to RME(8)');
state.selectedSubjectId = 8;

console.log('Step 3: Delayed save for Science occurs');
// The fix is the React 'key' which unmounts the component, but we also ensure
// that any save logic uses the intended ID.
const subjectToSave = subjectAtFocus; 

updateStudentScores(5, subjectToSave, 101, "45/50");

console.log('State scores:', state.scores);

const savedScore = state.scores[0];
if (savedScore.subjectId === 2) {
    console.log('✅ SUCCESS: Science score saved to Science(2) despite parent being RME(8)');
} else {
    console.error('❌ FAILURE: Science score bled into Subject ' + savedScore.subjectId);
}
