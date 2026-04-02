
const subjects = [
    { id: 1, subject: 'English Language' },
    { id: 11, subject: 'One World Other People (OWOP)' },
    { id: 2, subject: 'Science' }
];

const testUserID = {
    allowedSubjects: [1, 2]
};

const testUserName = {
    allowedSubjects: ['English Language', 'Science']
};

const getAvailableSubjects = (user, allSubjects) => {
    if (!user) return [];
    return allSubjects.filter(s => 
        user.allowedSubjects?.includes(s.id) || 
        user.allowedSubjects?.includes(s.subject)
    );
};

console.log('Testing ID-based permissions:');
const resID = getAvailableSubjects(testUserID, subjects);
console.log(resID.map(s => s.subject));
console.assert(resID.length === 2, 'Should find 2 subjects by ID');

console.log('Testing Name-based permissions:');
const resName = getAvailableSubjects(testUserName, subjects);
console.log(resName.map(s => s.subject));
console.assert(resName.length === 2, 'Should find 2 subjects by Name');

console.log('Verification Complete.');
