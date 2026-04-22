# Share HTML Platform - Project Overview & PDR

## Project Vision

Share HTML is a modern web platform that enables users to quickly upload HTML files and generate shareable links for easy content distribution. The platform provides a secure, efficient way to share web pages, documentation, prototypes, or any HTML content with others via simple URLs.

## Target Users

### Primary Users
- **Web Developers**: Share code snippets, demos, and prototypes
- **Designers**: Share mockups and design concepts via HTML
- **Content Creators**: Distribute articles, tutorials, and guides
- **Teams**: Collaborate on web projects by sharing HTML builds
- **Educators**: Share teaching materials and student examples

### Secondary Users
- **Project Stakeholders**: Review progress via shared HTML builds
- **Clients**: Preview websites without deployment requirements
- **QA Teams**: Test HTML content in isolated environments

## Core Features

### Primary Features
- **File Upload**: Drag-and-drop HTML file upload interface
- **Link Generation**: Automatic short, shareable URLs (10-character slugs)
- **HTML Viewer**: Secure sandboxed iframe rendering with CSP headers
- **Search Functionality**: Full-text search across all uploaded HTML content
- **Metadata Display**: Show filename, size, upload date, view count
- **Automatic Cleanup**: Files expire after 30 days

### Secondary Features
- **Theme Support**: Light/dark mode switching
- **Responsive Design**: Mobile-friendly interface
- **Loading States**: Proper feedback during operations
- **Error Handling**: Graceful error messages and fallbacks
- **Rate Limiting**: 10 requests/minute to prevent abuse

## Technical Requirements

### Functional Requirements
1. **File Upload**: Accept .html files up to 10MB
2. **Link Generation**: Create unique, readable slugs using nanoid
3. **HTML Rendering**: Display content in secure iframe with CSP
4. **Search**: Full-text search with pagination (10 results per page)
5. **Metadata**: Track filename, file size, MIME type, view count
6. **Expiration**: Automatic deletion after 30 days
7. **Security**: Token-based deletion authorization

### Non-Functional Requirements
- **Performance**: Fast load times, efficient search
- **Security**: Input validation, RLS policies, CSP headers
- **Reliability**: High availability, error recovery
- **Scalability**: Handle thousands of concurrent uploads
- **Maintainability**: Clean code structure, comprehensive testing

## Acceptance Criteria

### Upload Functionality
- [ ] Users can drag and drop HTML files onto the upload area
- [ ] File size validation (max 10MB)
- [ ] File type validation (.html only)
- [ ] Progress feedback during upload
- [ ] Success notification with generated share link
- [ ] Error messages for invalid files or size limits

### Share Link Generation
- [ ] Each upload generates a unique URL slug
- [ ] Links follow format: `https://app.domain/s/{slug}`
- [ ] Delete tokens generated for security
- [ ] Links work immediately after upload
- [ ] 404 page for invalid/expired links

### HTML Viewer
- [ ] Content renders in sandboxed iframe
- [ ] CSP headers prevent script execution
- [ ] Metadata displayed alongside HTML content
- [ ] Responsive layout across devices
- [ ] Loading states during content fetch

### Search Capability
- [ ] Full-text search across all HTML content
- [ ] Pagination (10 results per page)
- [ ] Search results show filename and snippet
- [ ] Real-time search as user types
- [ ] Empty state for no results

### Security & Reliability
- [ ] All API endpoints protected by rate limiting
- [ ] Delete tokens prevent unauthorized deletion
- [ ] Row Level Security on database
- [ ] Files automatically cleaned after 30 days
- [ ] Error handling for all failure scenarios

## Technical Constraints

### Technology Stack
- **Frontend**: Next.js 16.2.4, React 19, TypeScript 5
- **Database**: Supabase (PostgreSQL, Storage)
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Infrastructure**: Vercel, Upstash Redis

### Infrastructure Constraints
- Deploy on Vercel platform
- Use Supabase for backend services
- Rate limiting via Upstash Redis
- Static file storage via Supabase Storage

### Security Constraints
- Row Level Security (RLS) on all database operations
- Content Security Policy for HTML rendering
- Token-based authorization for sensitive operations
- Input validation on all user inputs

## Project Milestones

### Phase 1: Core Functionality (Complete)
- [x] Basic HTML file upload interface
- [x] Share link generation and viewing
- [x] Database schema and Supabase integration
- [x] Basic error handling and validation

### Phase 2: Enhanced Features (Complete)
- [x] Search functionality with pagination
- [x] Rate limiting and abuse prevention
- [x] Theme switching (light/dark mode)
- [x] Responsive design optimization

### Phase 3: Production Readiness (In Progress)
- [x] Performance optimization
- [x] Security hardening
- [ ] Comprehensive testing
- [ ] Monitoring and analytics

### Phase 4: Future Enhancements
- [ ] User authentication and profiles
- [ ] File organization and tagging
- [ ] Custom expiration dates
- [ ] Email notifications
- [ ] Analytics dashboard

## Success Metrics

### User Engagement
- Average session duration: > 3 minutes
- Uploads per session: > 1.5
- Search usage: > 30% of sessions
- Mobile vs desktop ratio: target 40/60 split

### Technical Performance
- Page load time: < 2 seconds
- Search response: < 500ms
- Upload success rate: > 99%
- Error rate: < 1%

### Business Metrics
- Daily active users: 1,000 (target)
- File uploads per day: 500 (target)
- Search queries per day: 200 (target)
- Share links created per day: 300 (target)

## Risk Assessment

### Technical Risks
- **Rate Limiting**: Upstash Redis service availability
- **Storage Costs**: Supabase Storage usage scaling
- **Performance**: Search with large HTML files
- **Security**: XSS vulnerabilities in HTML rendering

### Mitigation Strategies
- Monitor Upstash service health
- Implement storage usage monitoring
- Optimize search indexing for large files
- Rigorous CSP policy testing

### Business Risks
- **Abuse**: Spam or malicious content uploads
- **Competition**: Similar HTML sharing platforms
- **Monetization**: Free service sustainability

### Mitigation Strategies
- Advanced content moderation
- Unique value proposition development
- Freemium model consideration

## Future Roadmap

### Short Term (1-2 months)
- User authentication system
- File organization and folders
- Custom expiration options
- Email notifications

### Medium Term (3-6 months)
- Analytics dashboard
- API for developers
- Mobile applications
- Collaborative features

### Long Term (6-12 months)
- Premium subscription tiers
- Enterprise features
- Integration with development tools
- Advanced security features

## Project Team

### Current Team Structure
- **Development**: AI-powered development framework
- **Design**: Frontend/UI components
- **Infrastructure**: Vercel + Supabase
- **Testing**: Automated testing framework

### Roles and Responsibilities
- **Developer**: Implementation and testing
- **Designer**: UI/UX and user experience
- **DevOps**: Deployment and monitoring
- **QA**: Quality assurance and testing

## Documentation Requirements

### Technical Documentation
- API documentation for endpoints
- Database schema documentation
- Deployment guides and procedures
- Architecture diagrams and explanations

### User Documentation
- Getting started guide
- Feature documentation
- Troubleshooting guide
- Best practices for sharing

### Maintenance Documentation
- Monitoring and alerting setup
- Backup and recovery procedures
- Security configuration guide
- Performance optimization guide