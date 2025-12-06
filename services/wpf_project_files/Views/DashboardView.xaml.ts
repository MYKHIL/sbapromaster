
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.DashboardView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:DashboardViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <UserControl.Resources>
        <Style x:Key="StatCard" TargetType="materialDesign:Card">
            <Setter Property="Background" Value="{StaticResource SurfaceWhiteBrush}" />
            <Setter Property="Padding" Value="24" />
            <Setter Property="UniformCornerRadius" Value="12" />
            <Setter Property="RenderTransformOrigin" Value="0.5,0.5" />
            <Setter Property="RenderTransform">
                <Setter.Value>
                    <ScaleTransform />
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <EventTrigger RoutedEvent="MouseEnter">
                    <BeginStoryboard>
                        <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleX" To="1.05" Duration="0:0:0.2"/>
                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleY" To="1.05" Duration="0:0:0.2"/>
                        </Storyboard>
                    </BeginStoryboard>
                </EventTrigger>
                <EventTrigger RoutedEvent="MouseLeave">
                    <BeginStoryboard>
                        <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleX" To="1" Duration="0:0:0.2"/>
                            <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleY" To="1" Duration="0:0:0.2"/>
                        </Storyboard>
                    </BeginStoryboard>
                </EventTrigger>
            </Style.Triggers>
        </Style>
    </UserControl.Resources>
    
    <ScrollViewer VerticalScrollBarVisibility="Auto">
        <StackPanel>
            <materialDesign:Card Background="{StaticResource SurfaceWhiteBrush}" Padding="32" UniformCornerRadius="16" BorderThickness="1" BorderBrush="{StaticResource BorderBrush}">
                <StackPanel>
                    <TextBlock Text="Welcome to SBA Pro Master" FontSize="36" FontWeight="Bold" Foreground="{StaticResource PrimaryTextBrush}"/>
                    <TextBlock Text="Managing school assessments has never been easier." Margin="0,8,0,0" FontSize="18" Foreground="{StaticResource SecondaryTextBrush}"/>
                    <StackPanel Orientation="Horizontal" Margin="0,4,0,0">
                         <TextBlock Text="Currently managing assessments for" FontSize="18" Foreground="{StaticResource SecondaryTextBrush}"/>
                         <TextBlock Text="{Binding SchoolName}" FontWeight="SemiBold" Margin="4,0,0,0" FontSize="18" Foreground="{StaticResource PrimaryBlueBrush}"/>
                    </StackPanel>
                </StackPanel>
            </materialDesign:Card>
            
            <UniformGrid Columns="3" Margin="0,24,0,0">
                <!-- Total Students -->
                <materialDesign:Card Style="{StaticResource StatCard}" Margin="0,0,12,0">
                    <StackPanel Orientation="Horizontal">
                        <Border Background="#DBEAFE" CornerRadius="999" Width="56" Height="56" HorizontalAlignment="Center" VerticalAlignment="Center">
                           <materialDesign:PackIcon Kind="AccountGroup" Width="32" Height="32" Foreground="{StaticResource PrimaryBlueBrush}" VerticalAlignment="Center" HorizontalAlignment="Center" />
                        </Border>
                        <StackPanel Margin="16,0,0,0" VerticalAlignment="Center">
                            <TextBlock Text="Total Students" FontSize="14" FontWeight="Medium" Foreground="{StaticResource SecondaryTextBrush}" />
                            <TextBlock Text="{Binding TotalStudents}" FontSize="24" FontWeight="Bold" Foreground="{StaticResource PrimaryTextBrush}" />
                        </StackPanel>
                    </StackPanel>
                </materialDesign:Card>
                 <!-- Total Subjects -->
                <materialDesign:Card Style="{StaticResource StatCard}" Margin="12,0">
                    <StackPanel Orientation="Horizontal">
                        <Border Background="#DBEAFE" CornerRadius="999" Width="56" Height="56">
                           <materialDesign:PackIcon Kind="BookOpenPageVariant" Width="32" Height="32" Foreground="{StaticResource PrimaryBlueBrush}" VerticalAlignment="Center" HorizontalAlignment="Center" />
                        </Border>
                        <StackPanel Margin="16,0,0,0" VerticalAlignment="Center">
                            <TextBlock Text="Total Subjects" FontSize="14" FontWeight="Medium" Foreground="{StaticResource SecondaryTextBrush}" />
                            <TextBlock Text="{Binding TotalSubjects}" FontSize="24" FontWeight="Bold" Foreground="{StaticResource PrimaryTextBrush}" />
                        </StackPanel>
                    </StackPanel>
                </materialDesign:Card>
                <!-- Academic Year -->
                <materialDesign:Card Style="{StaticResource StatCard}" Margin="12,0,0,0">
                     <StackPanel Orientation="Horizontal">
                        <Border Background="#DBEAFE" CornerRadius="999" Width="56" Height="56">
                           <materialDesign:PackIcon Kind="Calendar" Width="32" Height="32" Foreground="{StaticResource PrimaryBlueBrush}" VerticalAlignment="Center" HorizontalAlignment="Center" />
                        </Border>
                        <StackPanel Margin="16,0,0,0" VerticalAlignment="Center">
                            <TextBlock Text="Academic Year" FontSize="14" FontWeight="Medium" Foreground="{StaticResource SecondaryTextBrush}" />
                            <TextBlock Text="{Binding AcademicYear}" FontSize="24" FontWeight="Bold" Foreground="{StaticResource PrimaryTextBrush}" />
                        </StackPanel>
                    </StackPanel>
                </materialDesign:Card>
            </UniformGrid>
            
            <materialDesign:Card Background="{StaticResource SurfaceWhiteBrush}" Padding="24" Margin="0,24,0,0" UniformCornerRadius="16" BorderThickness="1" BorderBrush="{StaticResource BorderBrush}">
                <StackPanel>
                     <TextBlock Text="Quick Start Guide" FontSize="22" FontWeight="Bold" Foreground="{StaticResource PrimaryTextBrush}" Margin="0,0,0,16"/>
                     <ItemsControl>
                        <ItemsControl.Items>
                            <TextBlock Margin="0,0,0,8" Foreground="{StaticResource SecondaryTextBrush}"><Run Text="1. Go to the "/><Run Text="School Setup" FontWeight="SemiBold" Foreground="{StaticResource PrimaryBlueBrush}"/><Run Text=" page to configure school details."/></TextBlock>
                            <TextBlock Margin="0,0,0,8" Foreground="{StaticResource SecondaryTextBrush}"><Run Text="2. Add your students and subjects in the "/><Run Text="Students" FontWeight="SemiBold" Foreground="{StaticResource PrimaryBlueBrush}"/><Run Text=" and "/><Run Text="Subjects" FontWeight="SemiBold" Foreground="{StaticResource PrimaryBlueBrush}"/><Run Text=" pages."/></TextBlock>
                            <TextBlock Margin="0,0,0,8" Foreground="{StaticResource SecondaryTextBrush}"><Run Text="3. Use the "/><Run Text="Score Entry" FontWeight="SemiBold" Foreground="{StaticResource PrimaryBlueBrush}"/><Run Text=" page to input assessment scores for each student."/></TextBlock>
                            <TextBlock Foreground="{StaticResource SecondaryTextBrush}"><Run Text="4. Generate and print beautiful report cards from the "/><Run Text="Report Viewer" FontWeight="SemiBold" Foreground="{StaticResource PrimaryBlueBrush}"/><Run Text="."/></TextBlock>
                        </ItemsControl.Items>
                     </ItemsControl>
                </StackPanel>
            </materialDesign:Card>
            
        </StackPanel>
    </ScrollViewer>
</UserControl>
`;
