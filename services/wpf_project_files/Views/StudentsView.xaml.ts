
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.StudentsView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:StudentsViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">

    <materialDesign:DialogHost IsOpen="{Binding IsModalOpen}"
                               CloseOnClickAway="True"
                               DialogContent="{Binding}">
        <materialDesign:DialogHost.DialogContentTemplate>
            <DataTemplate DataType="{x:Type viewmodels:StudentsViewModel}">
                 <ScrollViewer VerticalScrollBarVisibility="Auto" MaxHeight="600">
                    <StackPanel Margin="16" MinWidth="450">
                        <TextBlock Text="Add/Edit Student" Style="{StaticResource MaterialDesignHeadline6TextBlock}" Margin="0,0,0,16"/>
                        
                        <!-- Photo -->
                        <TextBlock Text="Student Photo" Style="{StaticResource MaterialDesignSubtitle2TextBlock}" Margin="0,8,0,8"/>
                        <Grid>
                            <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                            <Ellipse Grid.Column="0" Width="80" Height="80">
                                <Ellipse.Fill>
                                    <ImageBrush ImageSource="{Binding SelectedStudent.Picture, TargetNullValue={x:Null}}" Stretch="UniformToFill"/>
                                </Ellipse.Fill>
                            </Ellipse>
                            <StackPanel Grid.Column="1" Margin="16,0,0,0" VerticalAlignment="Center">
                                 <Button Content="Upload Image" Style="{StaticResource MaterialDesignOutlinedButton}" Margin="0,0,0,4"/>
                                 <Button Content="✨ Enhance Image" Style="{StaticResource MaterialDesignFlatButton}" Foreground="Indigo"/>
                            </StackPanel>
                        </Grid>
                        
                        <!-- Fields -->
                        <TextBox materialDesign:HintAssist.Hint="Name"
                                 Text="{Binding SelectedStudent.Name, UpdateSourceTrigger=PropertyChanged}"
                                 Margin="0,16,0,0"/>

                        <TextBox materialDesign:HintAssist.Hint="Index Number"
                                 Text="{Binding SelectedStudent.IndexNumber, UpdateSourceTrigger=PropertyChanged}"
                                 Margin="0,8,0,0"/>
                        
                        <ComboBox materialDesign:HintAssist.Hint="Class"
                                  ItemsSource="{Binding Classes}" DisplayMemberPath="Name"
                                  SelectedValue="{Binding SelectedStudent.ClassName}"
                                  Margin="0,8,0,0"/>

                        <ComboBox materialDesign:HintAssist.Hint="Gender"
                                  SelectedItem="{Binding SelectedStudent.Gender}"
                                  Margin="0,8,0,0">
                            <ComboBoxItem>Male</ComboBoxItem>
                            <ComboBoxItem>Female</ComboBoxItem>
                        </ComboBox>

                        <DatePicker materialDesign:HintAssist.Hint="Date of Birth"
                                    SelectedDate="{Binding SelectedStudent.DateOfBirth}"
                                    Margin="0,8,0,0"/>
                        
                        <TextBox materialDesign:HintAssist.Hint="Age"
                                 Text="{Binding SelectedStudent.Age}" IsReadOnly="True"
                                 Margin="0,8,0,0"/>


                        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
                            <Button Content="Cancel" Command="{Binding CloseModalCommand}" Style="{StaticResource MaterialDesignTextButton}" Margin="0,0,8,0"/>
                            <Button Content="Save" Command="{Binding SaveStudentCommand}" />
                        </StackPanel>
                    </StackPanel>
                 </ScrollViewer>
            </DataTemplate>
        </materialDesign:DialogHost.DialogContentTemplate>

        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto" />
                <RowDefinition Height="Auto" />
                <RowDefinition Height="*" />
            </Grid.RowDefinitions>

            <TextBlock Grid.Row="0" Text="Manage Students" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />
            
            <DockPanel Grid.Row="1" LastChildFill="False">
                <Button DockPanel.Dock="Right" Command="{Binding OpenAddModalCommand}"
                        Style="{StaticResource MaterialDesignRaisedButton}"
                        materialDesign:ButtonAssist.CornerRadius="8"
                        VerticalAlignment="Center">
                    <StackPanel Orientation="Horizontal">
                        <materialDesign:PackIcon Kind="Add" Margin="-4,0,8,0" />
                        <TextBlock Text="Add New Student" />
                    </StackPanel>
                </Button>

                <TextBox DockPanel.Dock="Left"
                         Text="{Binding SearchQuery, UpdateSourceTrigger=PropertyChanged}"
                         materialDesign:HintAssist.Hint="Search by name, index no, or class..."
                         materialDesign:TextFieldAssist.HasLeadingIcon="True"
                         materialDesign:TextFieldAssist.LeadingIcon="Search"
                         Style="{StaticResource MaterialDesignOutlinedTextBox}"
                         Width="300" />
            </DockPanel>


            <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="2" Color="Black" Opacity="0.2" BlurRadius="5" />
                </materialDesign:Card.Effect>
                <DataGrid ItemsSource="{Binding Students}"
                          AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                          Style="{StaticResource MaterialDesignDataGrid}">
                    <DataGrid.Columns>
                        <DataGridTemplateColumn Header="Photo" Width="Auto">
                            <DataGridTemplateColumn.CellTemplate>
                                <DataTemplate>
                                    <Ellipse Width="40" Height="40">
                                        <Ellipse.Fill>
                                            <ImageBrush ImageSource="{Binding Picture, TargetNullValue={x:Null}}" Stretch="UniformToFill" />
                                        </Ellipse.Fill>
                                    </Ellipse>
                                </DataTemplate>
                            </DataGridTemplateColumn.CellTemplate>
                        </DataGridTemplateColumn>

                        <DataGridTextColumn Header="Index Number" Binding="{Binding IndexNumber}" Width="Auto" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Name" Binding="{Binding Name}" FontWeight="SemiBold" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Class" Binding="{Binding ClassName}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Gender" Binding="{Binding Gender}" Width="Auto" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        
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