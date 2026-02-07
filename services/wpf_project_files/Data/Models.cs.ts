
export const content = `
namespace SBAProMaster.WPF.Data.Models;

public record Student(
    int Id,
    string Name,
    string? IndexNumber,
    string? Gender,
    string? ClassName,
    string? DateOfBirth,
    string? Age,
    byte[]? Picture
);

public record Subject(
    int Id,
    string Name,
    string? Type,
    string? Facilitator,
    byte[]? Signature
);

public record Class(
    int Id,
    string Name,
    string? TeacherName,
    byte[]? TeacherSignature
);

public record Grade(
    int Id,
    string Name,
    int MinScore,
    int MaxScore,
    string? Remark
);

public record Assessment(
    int Id,
    string Name,
    int Weight
);

public record ScoreEntry(
    int Id,
    int StudentId,
    int SubjectId,
    int AssessmentId,
    string ScoreValue // Stored as "value/basis", e.g., "15/20"
);

public record SchoolSettings(
    int Id,
    string? SchoolName,
    string? District,
    string? Address,
    string? AcademicYear,
    string? AcademicTerm,
    string? VacationDate,
    string? ReopeningDate,
    string? HeadmasterName,
    byte[]? Logo,
    byte[]? HeadmasterSignature
);

public record ReportSpecificData(
    int Id,
    int StudentId,
    string? Attendance,
    string? Conduct,
    string? Interest,
    string? Attitude,
    string? TeacherRemark
);

public record ClassSpecificData(
    int Id,
    int ClassId,
    string? TotalSchoolDays
);
`;