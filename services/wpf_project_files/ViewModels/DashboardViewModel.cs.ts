
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
// Add other necessary usings
namespace SBAProMaster.WPF.ViewModels;
public partial class DashboardViewModel : ObservableObject 
{
    // This would be populated from a service in a real app
    [ObservableProperty]
    private int _totalStudents = 0;
    [ObservableProperty]
    private int _totalSubjects = 0;
    [ObservableProperty]
    private string _schoolName = "Your School";
    [ObservableProperty]
    private string _academicYear = "2023/2024";
}
`;
