
export const content = `
# SBA Pro Master - WPF Project

This is a generated WPF application project that mirrors the functionality of the SBA Pro Master web application.

## Prerequisites

- .NET 8 SDK (or newer)
- An IDE like Visual Studio 2022, JetBrains Rider, or VS Code with the C# Dev Kit extension.

## How to Run

1.  **Extract the ZIP file:** Unzip the \`SBAProMaster_WPF_Project.zip\` file to a location on your computer.

2.  **Restore NuGet Packages:** Open a terminal or command prompt in the extracted project folder (the one with the \`.csproj\` file) and run the following command. (Most IDEs will do this automatically when you open the project).
    \`\`\`sh
    dotnet restore
    \`\`\`

3.  **Build and Run the Application:**
    You can either run the project from your IDE (usually by pressing F5) or use the command line:
    \`\`\`sh
    dotnet run
    \`\`\`

## Project Structure

- **/Data**: Contains Entity Framework Core DbContext and data models.
- **/Services**: Contains business logic for database operations, navigation, etc.
- **/ViewModels**: Contains the ViewModels for each page, following the MVVM pattern.
- **/Views**: Contains the XAML UI files for each page.
- **/Controls**: Contains complex, reusable UI components like the Report Card.
- **/Styles**: Contains global styles and color definitions.

## AI (Gemini) Integration

The AI-powered features (remark generation, image enhancement) are included as a placeholder service in \`Services/GeminiService.cs\`. To enable these features, you will need to:

1.  Get a Gemini API key from Google AI Studio.
2.  Implement the methods in \`GeminiService.cs\` to make REST API calls to the Gemini API endpoints using \`HttpClient\`.
3.  Securely manage your API key.
`;
