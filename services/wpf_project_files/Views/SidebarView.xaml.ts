
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.SidebarView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DesignHeight="800" d:DesignWidth="256">
    <UserControl.Resources>
        <Style x:Key="SidebarNavItemStyle" TargetType="ListBoxItem">
            <Setter Property="Padding" Value="12"/>
            <Setter Property="Margin" Value="0,4"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="ListBoxItem">
                        <Border x:Name="Bd"
                                Background="Transparent"
                                CornerRadius="8"
                                Padding="{TemplateBinding Padding}">
                            <StackPanel Orientation="Horizontal" ClipToBounds="True">
                                <Path Data="{Binding IconPath}" 
                                      Stretch="Uniform" 
                                      Width="24" Height="24"
                                      Fill="{Binding Foreground, RelativeSource={RelativeSource AncestorType=ListBoxItem}}"/>
                                <TextBlock Text="{Binding Name}" 
                                           x:Name="Label"
                                           Margin="12,0,0,0"
                                           VerticalAlignment="Center"
                                           FontWeight="Medium">
                                     <TextBlock.Style>
                                        <Style TargetType="TextBlock" BasedOn="{StaticResource {x:Type TextBlock}}">
                                            <Setter Property="Opacity" Value="0"/>
                                            <Setter Property="Visibility" Value="Collapsed"/>
                                            <Style.Triggers>
                                                <DataTrigger Binding="{Binding IsMouseOver, ElementName=MainBorder}" Value="True">
                                                    <DataTrigger.EnterActions>
                                                        <BeginStoryboard>
                                                            <Storyboard>
                                                                <DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.2" BeginTime="0:0:0.1"/>
                                                            </Storyboard>
                                                        </BeginStoryboard>
                                                    </DataTrigger.EnterActions>
                                                    <DataTrigger.ExitActions>
                                                         <BeginStoryboard>
                                                            <Storyboard>
                                                                <DoubleAnimation Storyboard.TargetProperty="Opacity" To="0" Duration="0:0:0.2"/>
                                                            </Storyboard>
                                                        </BeginStoryboard>
                                                    </DataTrigger.ExitActions>
                                                    <Setter Property="Visibility" Value="Visible"/>
                                                </DataTrigger>
                                                <DataTrigger Binding="{Binding IsSelected, RelativeSource={RelativeSource AncestorType=ListBoxItem}}" Value="True">
                                                      <Setter Property="Visibility" Value="Visible"/>
                                                      <Setter Property="Opacity" Value="1"/>
                                                </DataTrigger>
                                            </Style.Triggers>
                                        </Style>
                                    </TextBlock.Style>
                                </TextBlock>
                            </StackPanel>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsSelected" Value="True">
                                <Setter TargetName="Bd" Property="Background" Value="{StaticResource PrimaryBlueBrush}"/>
                                <Setter Property="Foreground" Value="White"/>
                            </Trigger>
                            <MultiDataTrigger>
                                <MultiDataTrigger.Conditions>
                                    <Condition Binding="{Binding IsMouseOver, RelativeSource={RelativeSource Self}}" Value="True" />
                                    <Condition Binding="{Binding IsSelected, RelativeSource={RelativeSource Self}}" Value="False" />
                                </MultiDataTrigger.Conditions>
                                <Setter TargetName="Bd" Property="Background" Value="#DBEAFE"/>
                                <Setter Property="Foreground" Value="{StaticResource PrimaryBlueBrush}"/>
                            </MultiDataTrigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </UserControl.Resources>

    <materialDesign:Card Background="White" x:Name="MainBorder" Width="80" Padding="0" BorderThickness="0">
        <materialDesign:Card.Style>
            <Style TargetType="materialDesign:Card">
                <Style.Triggers>
                    <EventTrigger RoutedEvent="MouseEnter">
                        <BeginStoryboard>
                            <Storyboard>
                                <DoubleAnimation Storyboard.TargetProperty="Width" To="256" Duration="0:0:0.3">
                                    <DoubleAnimation.EasingFunction>
                                        <CubicEase EasingMode="EaseOut"/>
                                    </DoubleAnimation.EasingFunction>
                                </DoubleAnimation>
                            </Storyboard>
                        </BeginStoryboard>
                    </EventTrigger>
                    <EventTrigger RoutedEvent="MouseLeave">
                        <BeginStoryboard>
                            <Storyboard>
                                <DoubleAnimation Storyboard.TargetProperty="Width" To="80" Duration="0:0:0.3">
                                    <DoubleAnimation.EasingFunction>
                                        <CubicEase EasingMode="EaseOut"/>
                                    </DoubleAnimation.EasingFunction>
                                </DoubleAnimation>
                            </Storyboard>
                        </BeginStoryboard>
                    </EventTrigger>
                </Style.Triggers>
            </Style>
        </materialDesign:Card.Style>
        
        <Grid Margin="16" ClipToBounds="True">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <!-- Header -->
            <StackPanel Orientation="Horizontal" Margin="0,0,0,32">
                <Border Background="{StaticResource PrimaryBlueBrush}" CornerRadius="8" Padding="8">
                     <Path Data="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-2.072-2.072a50.57 50.57 0 01-2.254-2.254" 
                           Stretch="Uniform" Width="32" Height="32" Fill="White"/>
                </Border>
                <TextBlock Text="SBA Pro Master" 
                           FontSize="20" FontWeight="Bold" 
                           VerticalAlignment="Center" Margin="12,0,0,0"
                           Visibility="Visible">
                    <TextBlock.Style>
                        <Style TargetType="TextBlock" BasedOn="{StaticResource {x:Type TextBlock}}">
                           <Setter Property="Opacity" Value="0"/>
                           <Style.Triggers>
                                <DataTrigger Binding="{Binding IsMouseOver, ElementName=MainBorder}" Value="True">
                                    <DataTrigger.EnterActions>
                                        <BeginStoryboard>
                                            <Storyboard><DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.2" BeginTime="0:0:0.1"/></Storyboard>
                                        </BeginStoryboard>
                                    </DataTrigger.EnterActions>
                                    <DataTrigger.ExitActions>
                                        <BeginStoryboard>
                                            <Storyboard><DoubleAnimation Storyboard.TargetProperty="Opacity" To="0" Duration="0:0:0.2"/></Storyboard>
                                        </BeginStoryboard>
                                    </DataTrigger.ExitActions>
                                </DataTrigger>
                            </Style.Triggers>
                        </Style>
                    </TextBlock.Style>
                </TextBlock>
            </StackPanel>
            
            <!-- Navigation -->
            <ListBox Grid.Row="1"
                     ItemsSource="{Binding NavItems}"
                     SelectedItem="{Binding SelectedNavItem}"
                     ItemContainerStyle="{StaticResource SidebarNavItemStyle}"
                     BorderThickness="0" Background="Transparent"
                     ScrollViewer.HorizontalScrollBarVisibility="Disabled"/>
            
             <!-- Footer -->
            <StackPanel Grid.Row="2" HorizontalAlignment="Center" TextBlock.TextAlignment="Center"
                        TextBlock.Foreground="{StaticResource SecondaryTextBrush}" TextBlock.FontSize="10">
                 <TextBlock Text="© 2024 SBA Pro Master" />
                 <TextBlock Text="Version 5.5.9" />
                 <StackPanel.Style>
                        <Style TargetType="StackPanel">
                           <Setter Property="Opacity" Value="0"/>
                           <Style.Triggers>
                                <DataTrigger Binding="{Binding IsMouseOver, ElementName=MainBorder}" Value="True">
                                    <DataTrigger.EnterActions>
                                        <BeginStoryboard>
                                            <Storyboard><DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.2" BeginTime="0:0:0.1"/></Storyboard>
                                        </BeginStoryboard>
                                    </DataTrigger.EnterActions>
                                    <DataTrigger.ExitActions>
                                        <BeginStoryboard>
                                            <Storyboard><DoubleAnimation Storyboard.TargetProperty="Opacity" To="0" Duration="0:0:0.2"/></Storyboard>
                                        </BeginStoryboard>
                                    </DataTrigger.ExitActions>
                                </DataTrigger>
                            </Style.Triggers>
                        </Style>
                 </StackPanel.Style>
            </StackPanel>
        </Grid>
    </materialDesign:Card>
</UserControl>
`;
