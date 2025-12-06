
export const content = `
using Microsoft.EntityFrameworkCore;
using SBAProMaster.WPF.Data.Models;

namespace SBAProMaster.WPF.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }

    public DbSet<Student> Students { get; set; }
    public DbSet<Subject> Subjects { get; set; }
    public DbSet<Class> Classes { get; set; }
    public DbSet<Grade> Grades { get; set; }
    public DbSet<Assessment> Assessments { get; set; }
    public DbSet<ScoreEntry> ScoreEntries { get; set; }
    public DbSet<SchoolSettings> Settings { get; set; }
    public DbSet<ReportSpecificData> ReportSpecificData { get; set; }
    public DbSet<ClassSpecificData> ClassSpecificData { get; set; }
}
`;
