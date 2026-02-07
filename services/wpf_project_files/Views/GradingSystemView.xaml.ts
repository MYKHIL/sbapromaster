
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.GradingSystemView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:GradingSystemViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <materialDesign:DialogHost IsOpen="{Binding IsModalOpen}"
                               CloseOnClickAway="True"
                               DialogContent="{Binding}">
        <materialDesign:DialogHost.DialogContentTemplate>
            <DataTemplate DataType="{x:Type viewmodels:GradingSystemViewModel}">
                <StackPanel Margin="16" MinWidth="350">
                    <TextBlock Text="Add/Edit Grade" Style="{StaticResource MaterialDesignHeadline6TextBlock}" Margin="0,0,0,16"/>
                    
                    <TextBox materialDesign:HintAssist.Hint="Grade Name (e.g., A+)"
                             Text="{Binding SelectedGrade.Name, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>
                    
                    <Grid>
                        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="16"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <TextBox Grid.Column="0" materialDesign:HintAssist.Hint="Minimum Score (%)"
                                 Text="{Binding SelectedGrade.MinScore, UpdateSourceTrigger=PropertyChanged}"
                                 Margin="0,8"/>
                        <TextBox Grid.Column="2" materialDesign:HintAssist.Hint="Maximum Score (%)"
                                 Text="{Binding SelectedGrade.MaxScore, UpdateSourceTrigger=PropertyChanged}"
                                 Margin="0,8"/>
                    </Grid>

                    <TextBox materialDesign:HintAssist.Hint="Remark (e.g., Excellent)"
                             Text="{Binding SelectedGrade.Remark, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>

                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
                        <Button Content="Cancel" Command="{Binding CloseModalCommand}" Style="{StaticResource MaterialDesignTextButton}" Margin="0,0,8,0"/>
                        <Button Content="Save" Command="{Binding SaveGradeCommand}" />
                    </StackPanel>
                </StackPanel>
            </DataTemplate>
        </materialDesign:DialogHost.DialogContentTemplate>

        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto" />
                <RowDefinition Height="Auto" />
                <RowDefinition Height="*" />
            </Grid.RowDefinitions>

            <TextBlock Grid.Row="0" Text="Manage Grading System" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />
            
            <DockPanel Grid.Row="1" LastChildFill="False">
                <Button DockPanel.Dock="Right" Command="{Binding OpenAddModalCommand}"
                        Style="{StaticResource MaterialDesignRaisedButton}"
                        materialDesign:ButtonAssist.CornerRadius="8"
                        VerticalAlignment="Center">
                    <StackPanel Orientation="Horizontal">
                        <materialDesign:PackIcon Kind="Add" Margin="-4,0,8,0" />
                        <TextBlock Text="Add New Grade" />
                    </StackPanel>
                </Button>
                
                 <Border BorderThickness="1" CornerRadius="8" Padding="16">
                     <Border.Style>
                         <Style TargetType="Border">
                            <Setter Property="BorderBrush" Value="#10B981"/>
                            <Setter Property="Background" Value="#D1FAE5"/>
                            <Style.Triggers>
                                <DataTrigger Binding="{Binding IsScaleValid}" Value="False">
                                    <Setter Property="BorderBrush" Value="#FBBF24"/>
                                    <Setter Property="Background" Value="#FEF9C3"/>
                                </DataTrigger>
                            </Style.Triggers>
                         </Style>
                     </Border.Style>
                     <TextBlock TextWrapping="Wrap">
                         <TextBlock.Style>
                              <Style TargetType="TextBlock">
                                <Setter Property="Foreground" Value="#065F46"/>
                                <Style.Triggers>
                                    <DataTrigger Binding="{Binding IsScaleValid}" Value="False">
                                        <Setter Property="Foreground" Value="#B45309"/>
                                    </DataTrigger>
                                </Style.Triggers>
                              </Style>
                         </TextBlock.Style>
                         <Run FontWeight="Bold">Grading Scale Status:</Run>
                         <Run Text="{Binding ScaleStatus}"/>
                     </TextBlock>
                </Border>
            </DockPanel>

            <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="2" Color="Black" Opacity="0.2" BlurRadius="5" />
                </materialDesign:Card.Effect>
                <DataGrid ItemsSource="{Binding Grades}"
                          AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                          Style="{StaticResource MaterialDesignDataGrid}">
                    <DataGrid.Columns>
                        <DataGridTextColumn Header="Grade" Binding="{Binding Name}" FontWeight="Bold" Width="Auto" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Score Range" Width="Auto" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}">
                            <DataGridTextColumn.Binding>
                                <MultiBinding StringFormat="{}{0}% - {1}%">
                                    <Binding Path="MinScore"/>
                                    <Binding Path="MaxScore"/>
                                </MultiBinding>
                            </DataGridTextColumn.Binding>
                        </DataGridTextColumn>
                        <DataGridTextColumn Header="Remark" Binding="{Binding Remark}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTemplateColumn Header="Actions" Width="Auto">
                            <DataGridTemplateColumn.CellTemplate>
                                <DataTemplate>
                                    <StackPanel Orientation="Horizontal">
                                        <Button Style="{StaticResource MaterialDesignIconButton}"
                                                Command="{Binding DataContext.OpenEditModalCommand, RelativeSource={RelativeSource AncestorType=DataGrid}}"
                                                CommandParameter="{Binding}"
                                                ToolTip="Edit">
                                            <materialDesign:PackIcon Kind="Pencil" Foreground="{StaticResource PrimaryBlueBrush}"/>
                                        </Button>
                                        <Button Style="{StaticResource MaterialDesignIconButton}" ToolTip="Delete">
                                            <materialDesign:PackIcon Kind="Delete" Foreground="{StaticResource DangerRedBrush}" />
                                        </Button>
                                    </StackPanel>
                                </DataTemplate>
                            </DataGridTemplateColumn.CellTemplate>
                        </DataGridTemplateColumn>
                    </DataGrid.Columns>
                </DataGrid>
            </materialDesign:Card>
        </Grid>
    </materialDesign:DialogHost>
</UserControl>
`;