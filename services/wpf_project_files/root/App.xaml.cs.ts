
export const content = `
using Microsoft.Extensions.DependencyInjection;
using SBAProMaster.WPF.Data;
using SBAProMaster.WPF.ViewModels;
using System.IO;
using System.Windows;
using Microsoft.EntityFrameworkCore;
using SBAProMaster.WPF.Services;

namespace SBAProMaster.WPF;

public partial class App : Application
{
    public static new App Current => (App)Application.Current;
    public IServiceProvider Services { get; }

    public App()
    {
        Services = ConfigureServices();
    }

    private static IServiceProvider ConfigureServices()
    {
        var services = new ServiceCollection();

        // Database
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dbPath = Path.Combine(appDataPath, "SBAProMaster", "sba_pro_master.db");
        Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
        services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));

        // Services
        services.AddSingleton<IDatabaseService, DatabaseService>();
        services.AddSingleton<Func<Type, object>>(s => viewModelType => s.GetRequiredService(viewModelType));

        // ViewModels
        services.AddSingleton<MainViewModel>();
        services.AddTransient<DashboardViewModel>();
        services.AddTransient<StudentsViewModel>();
        services.AddTransient<SettingsViewModel>();
        services.AddTransient<ClassesViewModel>();
        services.AddTransient<SubjectsViewModel>();
        services.AddTransient<GradingSystemViewModel>();
        services.AddTransient<AssessmentTypesViewModel>();
        services.AddTransient<ScoreEntryViewModel>();
        services.AddTransient<ReportViewerViewModel>();
        services.AddTransient<DataManagementViewModel>();


        return services.BuildServiceProvider();
    }

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Apply any pending database migrations
        using (var scope = Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await dbContext.Database.MigrateAsync();
        }

        var mainWindow = new MainWindow
        {
            DataContext = Services.GetRequiredService<MainViewModel>()
        };
        mainWindow.Show();
    }
}
`;