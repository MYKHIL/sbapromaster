
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.ScoreEntryView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:ScoreEntryViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto" />
            <RowDefinition Height="Auto" />
            <RowDefinition Height="*" />
        </Grid.RowDefinitions>

        <TextBlock Grid.Row="0" Text="Score Entry" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />

        <!-- Filter Panel -->
        <materialDesign:Card Grid.Row="1" Padding="16" UniformCornerRadius="12">
            <StackPanel Orientation="Horizontal">
                <ComboBox ItemsSource="{Binding Classes}" SelectedItem="{Binding SelectedClass}"
                          DisplayMemberPath="Name"
                          materialDesign:HintAssist.Hint="Select Class"
                          Style="{StaticResource MaterialDesignOutlinedComboBox}"
                          Width="250"/>
                <ComboBox ItemsSource="{Binding Subjects}" SelectedItem="{Binding SelectedSubject}"
                          DisplayMemberPath="Name"
                          materialDesign:HintAssist.Hint="Select Subject"
                          Style="{StaticResource MaterialDesignOutlinedComboBox}"
                          Width="250" Margin="16,0,0,0"/>
            </StackPanel>
        </materialDesign:Card>

        <!-- Main DataGrid -->
        <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
            <!-- DataGrid columns need to be dynamically generated in code-behind or via a behavior -->
            <DataGrid ItemsSource="{Binding StudentsInClass}"
                      AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                      Style="{StaticResource MaterialDesignDataGrid}">
                <DataGrid.Columns>
                    <DataGridTextColumn Header="Student Name" Binding="{Binding Name}" FontWeight="SemiBold" Width="2*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                    
                    <!-- Placeholder for dynamic columns -->
                    <DataGridTextColumn Header="Class Test 1 (10%)" Binding="{Binding Score1}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                    <DataGridTextColumn Header="Class Test 2 (10%)" Binding="{Binding Score2}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                    <DataGridTextColumn Header="Project Work (30%)" Binding="{Binding Score3}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                    <DataGridTextColumn Header="End of Term Exam (50%)" Binding="{Binding Score4}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                    
                    <DataGridTextColumn Header="Total (100%)" Binding="{Binding TotalScore}" FontWeight="Bold" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}"/>
                </DataGrid.Columns>
            </DataGrid>
        </materialDesign:Card>
    </Grid>
</UserControl>
`;