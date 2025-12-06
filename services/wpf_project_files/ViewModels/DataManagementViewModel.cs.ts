
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Threading.Tasks;

namespace SBAProMaster.WPF.ViewModels;

public partial class DataManagementViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ImportCommand))]
    [NotifyCanExecuteChangedFor(nameof(ExportCommand))]
    [NotifyCanExecuteChangedFor(nameof(GenerateWpfProjectCommand))]
    private bool _isBusy;

    [ObservableProperty]
    private string? _feedbackMessage;
    
    [ObservableProperty]
    private bool _isFeedbackOpen;

    [RelayCommand(CanExecute = nameof(CanExecuteAction))]
    private async Task ImportAsync()
    {
        IsBusy = true;
        await Task.Delay(2000); // Simulate import
        ShowFeedback("Database imported successfully (placeholder)!");
        IsBusy = false;
    }

    [RelayCommand(CanExecute = nameof(CanExecuteAction))]
    private async Task ExportAsync()
    {
        IsBusy = true;
        await Task.Delay(2000); // Simulate export
        ShowFeedback("Database exported successfully (placeholder)!");
        IsBusy = false;
    }

    [RelayCommand(CanExecute = nameof(CanExecuteAction))]
    private async Task GenerateWpfProjectAsync()
    {
        IsBusy = true;
        await Task.Delay(3000); // Simulate generation
        ShowFeedback("WPF Project generated and downloaded (placeholder)!");
        IsBusy = false;
    }

    private bool CanExecuteAction() => !IsBusy;
    
    private void ShowFeedback(string message)
    {
        FeedbackMessage = message;
        IsFeedbackOpen = true;
    }

    [RelayCommand]
    private void CloseFeedback()
    {
        IsFeedbackOpen = false;
    }
}
`;