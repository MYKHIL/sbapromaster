
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.DataManagementView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:DataManagementViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">

    <Grid>
        <ScrollViewer VerticalScrollBarVisibility="Auto">
            <StackPanel MaxWidth="800">
                <TextBlock Text="Data Management" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,24" />

                <!-- Import & Export -->
                <materialDesign:Card Padding="32" UniformCornerRadius="12" Margin="0,0,0,24">
                    <StackPanel>
                        <Border BorderBrush="{StaticResource BorderBrush}" BorderThickness="0,0,0,1" Padding="0,0,0,8" Margin="0,0,0,16">
                            <TextBlock Text="Import &amp; Export" Style="{StaticResource MaterialDesignHeadline6TextBlock}"/>
                        </Border>
                        <TextBlock Text="You can back up all your school's data into a single .sdlx file. This file can be stored securely and used to restore your data on this or another computer."
                                   TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" Margin="0,0,0,24"/>
                        <Grid>
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width="*" />
                                <ColumnDefinition Width="32" />
                                <ColumnDefinition Width="*" />
                            </Grid.ColumnDefinitions>

                            <StackPanel Grid.Column="0">
                                <TextBlock Text="Import Data" FontWeight="SemiBold" FontSize="16" Margin="0,0,0,4"/>
                                <TextBlock TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" FontSize="13">Load data from an .sdlx database file. <Run FontWeight="Bold" Foreground="{StaticResource DangerRedBrush}">This will overwrite all current data.</Run></TextBlock>
                                <Button Content="Import Database File" Command="{Binding ImportCommand}" IsEnabled="{Binding IsBusy, Converter={StaticResource InverseBooleanConverter}}" HorizontalAlignment="Left" Margin="0,12,0,0"/>
                            </StackPanel>

                            <StackPanel Grid.Column="2">
                                <TextBlock Text="Export Data" FontWeight="SemiBold" FontSize="16" Margin="0,0,0,4"/>
                                <TextBlock TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" FontSize="13">Save all current data to an .sdlx database file as a backup.</TextBlock>
                                <Button Content="Download Database File" Command="{Binding ExportCommand}" IsEnabled="{Binding IsBusy, Converter={StaticResource InverseBooleanConverter}}" HorizontalAlignment="Left" Margin="0,12,0,0"/>
                            </StackPanel>
                        </Grid>
                    </StackPanel>
                </materialDesign:Card>

                <!-- Developer Tools -->
                <materialDesign:Card Padding="32" UniformCornerRadius="12" Margin="0,0,0,24">
                    <StackPanel>
                        <Border BorderBrush="{StaticResource BorderBrush}" BorderThickness="0,0,0,1" Padding="0,0,0,8" Margin="0,0,0,16">
                            <TextBlock Text="Developer Tools" Style="{StaticResource MaterialDesignHeadline6TextBlock}"/>
                        </Border>
                        <TextBlock Text="Generate developer assets to recreate this application on other platforms."
                                   TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" Margin="0,0,0,24"/>
                        <Grid>
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width="*" />
                                <ColumnDefinition Width="32" />
                                <ColumnDefinition Width="*" />
                            </Grid.ColumnDefinitions>

                            <StackPanel Grid.Column="0">
                                <TextBlock Text="WPF App Recreation Prompt" FontWeight="SemiBold" FontSize="16" Margin="0,0,0,4"/>
                                <TextBlock TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" FontSize="13">Downloads a comprehensive .txt file with instructions for an AI to build a WPF version of SBA Pro Master.</TextBlock>
                                <Button Content="Download Prompt (.txt)" IsEnabled="{Binding IsBusy, Converter={StaticResource InverseBooleanConverter}}" HorizontalAlignment="Left" Margin="0,12,0,0"/>
                            </StackPanel>

                            <StackPanel Grid.Column="2">
                                <TextBlock Text="WPF Project Source Code" FontWeight="SemiBold" FontSize="16" Margin="0,0,0,4"/>
                                <TextBlock TextWrapping="Wrap" Foreground="{StaticResource SecondaryTextBrush}" FontSize="13">Generates all C# and XAML source code for the WPF application and bundles it into a downloadable .zip file.</TextBlock>
                                <Button Content="Generate Project (.zip)" Command="{Binding GenerateWpfProjectCommand}" IsEnabled="{Binding IsBusy, Converter={StaticResource InverseBooleanConverter}}" HorizontalAlignment="Left" Margin="0,12,0,0"/>
                            </StackPanel>
                        </Grid>
                    </StackPanel>
                </materialDesign:Card>
            </StackPanel>
        </ScrollViewer>
        
        <!-- Feedback Panel -->
        <materialDesign:Card Padding="16" UniformCornerRadius="12"
                             VerticalAlignment="Top" HorizontalAlignment="Right" Margin="24"
                             Background="#FEF9C3" BorderBrush="#FBBF24" BorderThickness="1"
                             Visibility="{Binding IsFeedbackOpen, Converter={StaticResource BooleanToVisibilityConverter}}">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto" />
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="Auto" />
                </Grid.ColumnDefinitions>
                <materialDesign:PackIcon Kind="Alert" Foreground="#B45309" VerticalAlignment="Top" Margin="0,4,0,0"/>
                <TextBlock Grid.Column="1" Text="{Binding FeedbackMessage}" TextWrapping="Wrap" Margin="12,0" Foreground="#B45309" FontWeight="SemiBold"/>
                <Button Grid.Column="2" Style="{StaticResource MaterialDesignIconButton}" Command="{Binding CloseFeedbackCommand}" Margin="-12,-12,0,0">
                    <materialDesign:PackIcon Kind="Close" />
                </Button>
            </Grid>
        </materialDesign:Card>
    </Grid>
</UserControl>
`;
