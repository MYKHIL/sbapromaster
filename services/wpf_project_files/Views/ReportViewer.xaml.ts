// FIX: The file contains XAML, not TypeScript. The content has been wrapped in a template literal and exported as a constant named 'content' to conform to the project's structure for handling non-TS assets. This resolves numerous TypeScript parsing errors.
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.ReportViewer"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:controls="clr-namespace:SBAProMaster.WPF.Controls"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:ReportViewerViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <Grid>
        <!-- Main Content Area -->
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row="0" Text="Report Viewer" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />

            <!-- Filter Panel -->
             <materialDesign:Card Grid.Row="1" Padding="16" UniformCornerRadius="12">
                 <StackPanel Orientation="Horizontal">
                    <ComboBox ItemsSource="{Binding Classes}" SelectedItem="{Binding SelectedClass}"
                              DisplayMemberPath="Name"
                              materialDesign:HintAssist.Hint="Select Class"
                              Style="{StaticResource MaterialDesignOutlinedComboBox}"
                              Width="200"/>
                    <TextBox Text="{Binding TotalSchoolDays}"
                             materialDesign:HintAssist.Hint="Total School Days"
                             Style="{StaticResource MaterialDesignOutlinedTextBox}"
                             Width="150" Margin="16,0,0,0"/>
                    <ComboBox ItemsSource="{Binding StudentsInClass}" SelectedItem="{Binding SelectedStudent}"
                              DisplayMemberPath="Name"
                              materialDesign:HintAssist.Hint="Select Student"
                              Style="{StaticResource MaterialDesignOutlinedComboBox}"
                              Width="200" Margin="16,0,0,0"/>
                 </StackPanel>
             </materialDesign:Card>

            <!-- Report Display -->
            <ScrollViewer Grid.Row="2" HorizontalScrollBarVisibility="Auto" VerticalScrollBarVisibility="Auto" Margin="0,16,0,0"
                          HorizontalContentAlignment="Center">
                <ItemsControl ItemsSource="{Binding ReportsToDisplay}">
                    <ItemsControl.ItemTemplate>
                        <DataTemplate>
                            <Grid Margin="10">
                                <controls:ReportCardView DataContext="{Binding}" />
                                <Grid.Effect>
                                    <DropShadowEffect ShadowDepth="3" Color="Black" Opacity="0.2" BlurRadius="10"/>
                                </Grid.Effect>
                            </Grid>
                        </DataTemplate>
                    </ItemsControl.ItemTemplate>
                </ItemsControl>
            </ScrollViewer>
        </Grid>
        
        <!-- Overlay for Slide-out Panel -->
        <Grid>
            <!-- Customization Panel -->
            <materialDesign:Card x:Name="CustomizationPanel"
                                 Padding="24" UniformCornerRadius="12"
                                 Width="384" HorizontalAlignment="Right"
                                 RenderTransformOrigin="1,0.5">
                <materialDesign:Card.Background>
                    <SolidColorBrush Color="White" Opacity="0.8" />
                </materialDesign:Card.Background>
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="5" Color="Black" Opacity="0.3" BlurRadius="15"/>
                </materialDesign:Card.Effect>
                <materialDesign:Card.RenderTransform>
                    <TranslateTransform X="352" />
                </materialDesign:Card.RenderTransform>
                <materialDesign:Card.Style>
                    <Style TargetType="materialDesign:Card">
                        <Style.Triggers>
                            <DataTrigger Binding="{Binding IsCustomizationPanelOpen}" Value="True">
                                <DataTrigger.EnterActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.(TranslateTransform.X)"
                                                             To="0" Duration="0:0:0.5">
                                                <DoubleAnimation.EasingFunction><ExponentialEase EasingMode="EaseOut"/></DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </DataTrigger.EnterActions>
                                <DataTrigger.ExitActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.(TranslateTransform.X)"
                                                             To="352" Duration="0:0:0.5">
                                                <DoubleAnimation.EasingFunction><ExponentialEase EasingMode="EaseIn"/></DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </DataTrigger.ExitActions>
                            </DataTrigger>
                        </Style.Triggers>
                    </Style>
                </materialDesign:Card.Style>
                <!-- Panel Content -->
                <Grid>
                    <TextBlock Text="Report Details for John Doe" Style="{StaticResource MaterialDesignHeadline6TextBlock}" />
                    <!-- Add all the textboxes and AI buttons here -->
                </Grid>
            </materialDesign:Card>
        </Grid>

        <!-- Floating Print Button -->
        <Button Style="{StaticResource MaterialDesignFloatingActionDarkButton}"
                HorizontalAlignment="Right" VerticalAlignment="Bottom" Margin="32"
                Width="56" Height="56">
            <materialDesign:PackIcon Kind="Printer" Height="24" Width="24" />
        </Button>
    </Grid>
</UserControl>
`;