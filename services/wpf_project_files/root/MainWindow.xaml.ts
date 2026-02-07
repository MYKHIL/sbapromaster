
export const content = `
<Window x:Class="SBAProMaster.WPF.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:views="clr-namespace:SBAProMaster.WPF.Views"
        xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
        mc:Ignorable="d"
        Title="SBA Pro Master" Height="800" Width="1200"
        WindowStartupLocation="CenterScreen"
        Background="{StaticResource BackgroundGrayBrush}">
    <Window.Resources>
        <!-- DataTemplates to map ViewModels to Views -->
        <DataTemplate DataType="{x:Type viewmodels:DashboardViewModel}">
            <views:DashboardView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type viewmodels:StudentsViewModel}">
            <views:StudentsView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type viewmodels:SubjectsViewModel}">
            <views:SubjectsView />
        </DataTemplate>
         <DataTemplate DataType="{x:Type viewmodels:ClassesViewModel}">
            <views:ClassesView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type viewmodels:GradingSystemViewModel}">
            <views:GradingSystemView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type viewmodels:AssessmentTypesViewModel}">
            <views:AssessmentTypesView />
        </DataTemplate>
         <DataTemplate DataType="{x:Type viewmodels:ScoreEntryViewModel}">
            <views:ScoreEntryView />
        </DataTemplate>
         <DataTemplate DataType="{x:Type viewmodels:ReportViewerViewModel}">
            <views:ReportViewer />
        </DataTemplate>
         <DataTemplate DataType="{x:Type viewmodels:SettingsViewModel}">
            <views:SettingsView />
        </DataTemplate>
         <DataTemplate DataType="{x:Type viewmodels:DataManagementViewModel}">
            <views:DataManagementView />
        </DataTemplate>
    </Window.Resources>
    
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto" />
            <ColumnDefinition Width="*" />
        </Grid.ColumnDefinitions>

        <views:SidebarView Grid.Column="0" DataContext="{Binding}" />

        <ContentControl Grid.Column="1" 
                        Margin="24"
                        Content="{Binding CurrentViewModel}" />

    </Grid>
</Window>
`;
