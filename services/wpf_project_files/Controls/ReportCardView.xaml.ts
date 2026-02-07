// FIX: The file contains XAML, not TypeScript. The content has been wrapped in a template literal and exported as a constant named 'content' to conform to the project's structure for handling non-TS assets. This resolves numerous TypeScript parsing errors.
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Controls.ReportCardView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:local="clr-namespace:SBAProMaster.WPF.Controls"
             mc:Ignorable="d" 
             d:DesignHeight="1123" d:DesignWidth="794"
             Width="794" Height="1123"
             FontFamily="Times New Roman" FontSize="13pt"
             Background="White">
    <UserControl.Resources>
        <Style x:Key="InfoItemStyle" TargetType="Grid">
            <Setter Property="Margin" Value="0,1" />
        </Style>

        <Style x:Key="InfoLabelStyle" TargetType="TextBlock">
            <Setter Property="FontWeight" Value="Bold" />
            <Setter Property="VerticalAlignment" Value="Bottom" />
        </Style>

        <Style x:Key="InfoValueStyle" TargetType="Border">
            <Setter Property="BorderBrush" Value="Black" />
            <Setter Property="BorderThickness" Value="0,0,0,1" />
            <Setter Property="Margin" Value="4,0,0,0" />
            <Setter Property="MinHeight" Value="20"/>
        </Style>
        
        <Style x:Key="PerformanceCellStyle" TargetType="TextBlock">
            <Setter Property="Padding" Value="2,1" />
            <Setter Property="TextAlignment" Value="Center" />
            <Setter Property="VerticalAlignment" Value="Center"/>
        </Style>
        
    </UserControl.Resources>

    <Border BorderBrush="Black" BorderThickness="4" Margin="20">
        <Grid Margin="15,10">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto" /> <!-- Header -->
                <RowDefinition Height="Auto" /> <!-- Student Details -->
                <RowDefinition Height="*" />   <!-- Academic Performance -->
                <RowDefinition Height="Auto" /> <!-- Grading Key -->
                <RowDefinition Height="Auto" /> <!-- Remarks -->
                <RowDefinition Height="Auto" /> <!-- Signatures -->
            </Grid.RowDefinitions>

            <!-- Header -->
            <Grid Grid.Row="0" Margin="0,0,0,10" VerticalAlignment="Center">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="2*" />
                    <ColumnDefinition Width="*" />
                </Grid.ColumnDefinitions>
                <Image Grid.Column="0" Source="{Binding SchoolSettings.Logo}" Stretch="Uniform" Width="160" Height="128" HorizontalAlignment="Left" />
                <StackPanel Grid.Column="1" VerticalAlignment="Center" HorizontalAlignment="Center">
                    <TextBlock Text="{Binding SchoolSettings.SchoolName}" FontSize="28" FontWeight="Bold" HorizontalAlignment="Center" TextWrapping="Wrap" TextAlignment="Center"/>
                    <TextBlock Text="{Binding SchoolSettings.Address}" TextWrapping="Wrap" TextAlignment="Center" Margin="0,5,0,0" />
                    <TextBlock Text="TERMINAL REPORT" FontSize="20" FontWeight="SemiBold" HorizontalAlignment="Center" Margin="0,5,0,0"/>
                </StackPanel>
            </Grid>

            <!-- Student Details -->
            <Grid Grid.Row="1" Margin="0,5">
                 <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="Auto" />
                </Grid.ColumnDefinitions>
                
                <StackPanel Grid.Column="0">
                    <!-- Name -->
                    <Grid Style="{StaticResource InfoItemStyle}" Margin="0,5,0,10">
                        <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <TextBlock Grid.Column="0" Style="{StaticResource InfoLabelStyle}" Text="Name:" />
                        <Border Grid.Column="1" Style="{StaticResource InfoValueStyle}">
                            <local:FitTextBlock Text="{Binding Student.Name}" MinFontSize="14" FontSize="18" FontWeight="Bold" VerticalAlignment="Bottom" />
                        </Border>
                    </Grid>
                    
                    <!-- Other Details -->
                    <Grid>
                        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
                        
                        <!-- Row 1 -->
                        <Grid Grid.Row="0" Grid.Column="0" Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Academic Year: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding AcademicYear}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="0" Grid.Column="1" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Term: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Term}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="0" Grid.Column="2" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Class: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Student.ClassName}" VerticalAlignment="Bottom"/></Border></Grid>
                        
                        <!-- Row 2 -->
                        <Grid Grid.Row="1" Grid.Column="0" Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Index Number: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Student.IndexNumber}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="1" Grid.Column="1" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Age: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Student.Age}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="1" Grid.Column="2" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Gender: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Student.Gender}" VerticalAlignment="Bottom"/></Border></Grid>

                        <!-- Row 3 -->
                        <Grid Grid.Row="2" Grid.Column="0" Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Total Score: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding TotalScore}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="2" Grid.Column="1" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Aggregate: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Aggregate}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="2" Grid.Column="2" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Position: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Position}" VerticalAlignment="Bottom"/></Border></Grid>
                        
                        <!-- Row 4 -->
                        <Grid Grid.Row="3" Grid.Column="0" Grid.ColumnSpan="2" Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Vacation Date: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding VacationDate}" VerticalAlignment="Bottom"/></Border></Grid>
                        <Grid Grid.Row="3" Grid.Column="2" Style="{StaticResource InfoItemStyle}" Margin="10,1"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Reopening Date: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding ReopeningDate}" VerticalAlignment="Bottom"/></Border></Grid>
                    </Grid>
                </StackPanel>

                <Border Grid.Column="1" BorderBrush="Black" BorderThickness="2" Width="128" Height="160" Margin="15,0,0,0">
                    <Image Source="{Binding Student.Picture}" Stretch="UniformToFill"/>
                </Border>
            </Grid>

            <!-- Academic Performance -->
            <StackPanel Grid.Row="2" VerticalAlignment="Center">
                 <TextBlock Text="ACADEMIC PERFORMANCE" FontSize="16" FontWeight="Bold" HorizontalAlignment="Center" Margin="0,10,0,5"/>
                 <Border BorderBrush="Black" BorderThickness="1">
                     <ItemsControl ItemsSource="{Binding SubjectResults}">
                         <ItemsControl.ItemsPanel>
                            <ItemsPanelTemplate>
                                 <Grid>
                                     <Grid.ColumnDefinitions>
                                         <ColumnDefinition Width="2*"/> <!-- Subject -->
                                         <ColumnDefinition Width="*"/>  <!-- Class Score -->
                                         <ColumnDefinition Width="*"/>  <!-- Exam Score -->
                                         <ColumnDefinition Width="*"/>  <!-- Total -->
                                         <ColumnDefinition Width="*"/>  <!-- Grade -->
                                         <ColumnDefinition Width="*"/>  <!-- Position -->
                                         <ColumnDefinition Width="*"/>  <!-- Remarks -->
                                     </Grid.ColumnDefinitions>
                                 </Grid>
                             </ItemsPanelTemplate>
                         </ItemsControl.ItemsPanel>
                         <ItemsControl.ItemTemplate>
                             <DataTemplate>
                                <Grid>
                                    <Grid.ColumnDefinitions>
                                         <ColumnDefinition Width="2*"/> <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/>
                                         <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/>
                                         <ColumnDefinition Width="*"/>
                                    </Grid.ColumnDefinitions>
                                    <Border BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding Subject}" FontWeight="Bold" Style="{StaticResource PerformanceCellStyle}" TextAlignment="Left" Padding="2,1"/></Border>
                                    <Border Grid.Column="1" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding ClassScore}" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                    <Border Grid.Column="2" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding ExamScore}" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                    <Border Grid.Column="3" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding TotalScore}" FontWeight="Bold" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                    <Border Grid.Column="4" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding Grade}" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                    <Border Grid.Column="5" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="{Binding Position}" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                    <Border Grid.Column="6" BorderBrush="Black" BorderThickness="0,0,0,1"><TextBlock Text="{Binding Remark}" FontWeight="Bold" Style="{StaticResource PerformanceCellStyle}"/></Border>
                                 </Grid>
                             </DataTemplate>
                         </ItemsControl.ItemTemplate>
                         <ItemsControl.Template>
                            <ControlTemplate TargetType="ItemsControl">
                                <StackPanel>
                                    <!-- Header Row -->
                                    <Grid TextBlock.FontWeight="Bold" TextBlock.TextAlignment="Center" Background="#E5E7EB" TextBlock.FontSize="11pt">
                                        <Grid.ColumnDefinitions>
                                            <ColumnDefinition Width="2*"/> <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/>
                                            <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/> <ColumnDefinition Width="*"/>
                                            <ColumnDefinition Width="*"/>
                                        </Grid.ColumnDefinitions>
                                        <Border BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="SUBJECT" Padding="2,1"/></Border>
                                        <Border Grid.Column="1" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock TextWrapping="Wrap" Padding="2,1">CLASS SCORE (30%)</TextBlock></Border>
                                        <Border Grid.Column="2" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock TextWrapping="Wrap" Padding="2,1">EXAM SCORE (70%)</TextBlock></Border>
                                        <Border Grid.Column="3" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock TextWrapping="Wrap" Padding="2,1">TOTAL (100%)</TextBlock></Border>
                                        <Border Grid.Column="4" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="GRADE" Padding="2,1"/></Border>
                                        <Border Grid.Column="5" BorderBrush="Black" BorderThickness="0,0,1,1"><TextBlock Text="POSITION" Padding="2,1"/></Border>
                                        <Border Grid.Column="6" BorderBrush="Black" BorderThickness="0,0,0,1"><TextBlock Text="REMARKS" Padding="2,1"/></Border>
                                    </Grid>
                                    <!-- Items -->
                                    <ItemsPresenter/>
                                </StackPanel>
                            </ControlTemplate>
                         </ItemsControl.Template>
                     </ItemsControl>
                 </Border>
            </StackPanel>

            <!-- Grading Key -->
            <Border Grid.Row="3" Background="Black" Margin="0,10" Padding="5,2" CornerRadius="5">
                <StackPanel>
                    <Border BorderBrush="Gray" BorderThickness="0,0,0,1" Padding="0,0,0,2">
                        <TextBlock Text="Grading Key" Foreground="White" FontWeight="Bold" HorizontalAlignment="Center" />
                    </Border>
                    <UniformGrid Columns="4" Margin="0,2,0,0" TextBlock.Foreground="White" TextBlock.FontSize="9pt">
                        <!-- This would be populated from data in a real app -->
                        <TextBlock Text="A+ (80-100) Excellent"/>
                        <TextBlock Text="A  (75-79) Very Good"/>
                        <TextBlock Text="B+ (70-74) Good"/>
                        <TextBlock Text="B  (65-69) Credit"/>
                        <TextBlock Text="C+ (60-64) Credit"/>
                        <TextBlock Text="C  (55-59) Pass"/>
                        <TextBlock Text="D+ (50-54) Pass"/>
                        <TextBlock Text="D  (45-49) Weak Pass"/>
                        <TextBlock Text="E  (40-44) Weak Pass"/>
                        <TextBlock Text="F  (0-39) Fail"/>
                    </UniformGrid>
                </StackPanel>
            </Border>
            
            <!-- Remarks -->
            <StackPanel Grid.Row="4" Margin="0,5,0,10">
                <Grid Style="{StaticResource InfoItemStyle}">
                    <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="80"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="80"/></Grid.ColumnDefinitions>
                    <TextBlock Grid.Column="0" Style="{StaticResource InfoLabelStyle}" Text="Attendance: "/>
                    <Border Grid.Column="1" Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Attendance}" VerticalAlignment="Bottom" HorizontalAlignment="Center"/></Border>
                    <TextBlock Grid.Column="2" Style="{StaticResource InfoLabelStyle}" Text=" out of "/>
                    <Border Grid.Column="3" Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding TotalSchoolDays}" VerticalAlignment="Bottom" HorizontalAlignment="Center"/></Border>
                </Grid>
                <Grid Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Conduct: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Conduct}" VerticalAlignment="Bottom"/></Border></Grid>
                <Grid Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Interest: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Interest}" VerticalAlignment="Bottom"/></Border></Grid>
                <Grid Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Attitude: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding Attitude}" VerticalAlignment="Bottom"/></Border></Grid>
                <Grid Style="{StaticResource InfoItemStyle}"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions><TextBlock Style="{StaticResource InfoLabelStyle}" Text="Class Teacher's Remarks: "/><Border Style="{StaticResource InfoValueStyle}"><local:FitTextBlock Text="{Binding TeacherRemark}" VerticalAlignment="Bottom"/></Border></Grid>
            </StackPanel>
            
            <!-- Signatures -->
            <Grid Grid.Row="5" Margin="0,20,0,0">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="*"/>
                </Grid.ColumnDefinitions>

                <StackPanel Grid.Column="0" TextBlock.TextAlignment="Center">
                    <Image Source="{Binding Class.TeacherSignature}" Height="40" Stretch="Uniform" />
                    <Border BorderBrush="Black" BorderThickness="0,1,0,0" Margin="10,5,10,0" Padding="0,2,0,0">
                        <StackPanel>
                            <TextBlock Text="Class Teacher's Signature" FontWeight="SemiBold"/>
                            <TextBlock Text="{Binding Class.TeacherName}" TextWrapping="Wrap"/>
                        </StackPanel>
                    </Border>
                </StackPanel>

                <StackPanel Grid.Column="1" TextBlock.TextAlignment="Center">
                     <Image Source="{Binding SchoolSettings.HeadmasterSignature}" Height="40" Stretch="Uniform" />
                     <Border BorderBrush="Black" BorderThickness="0,1,0,0" Margin="10,5,10,0" Padding="0,2,0,0">
                        <StackPanel>
                            <TextBlock Text="Headmaster's Signature" FontWeight="SemiBold"/>
                            <TextBlock Text="{Binding SchoolSettings.HeadmasterName}" TextWrapping="Wrap"/>
                        </StackPanel>
                    </Border>
                </StackPanel>

                <Grid Grid.Column="2" Height="112" Width="224" HorizontalAlignment="Center" VerticalAlignment="Bottom">
                    <Rectangle Stroke="Black" StrokeThickness="2" RadiusX="5" RadiusY="5" StrokeDashArray="4 2"/>
                    <TextBlock Text="Official School Stamp / Seal" HorizontalAlignment="Center" VerticalAlignment="Center" Foreground="Gray"/>
                </Grid>
            </Grid>

            <!-- Footer -->
            <TextBlock Grid.Row="5" Text="Powered by MYKHIL Creations (+233) 0542410613" FontSize="9pt" VerticalAlignment="Bottom" HorizontalAlignment="Center" Margin="0,0,0,-30"/>
        </Grid>
    </Border>
</UserControl>
`;