namespace Kendo.Mvc.UI
{
    using Kendo.Mvc.Extensions;
    using Kendo.Mvc.Infrastructure;
    using Kendo.Mvc.Resources;
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Web.Mvc;
    
    public class Calendar : ViewComponentBase
    {
        private readonly IUrlGenerator urlGenerator;

        public Calendar(ViewContext viewContext, IJavaScriptInitializer initializer, IUrlGenerator urlGenerator)
            : base(viewContext, initializer)
        {
            this.urlGenerator = urlGenerator;

            MonthTemplate = new MonthTemplate();

            SelectionSettings = new CalendarSelectionSettings();
        }

        public MonthTemplate MonthTemplate
        {
            get;
            private set;
        }

        public string Format
        {
            get;
            set;
        }

        public string Footer
        {
            get;
            set;
        }

        public string Start
        {
            get;
            set;
        }

        public string Depth
        {
            get;
            set;
        }

        public DateTime? Min
        {
            get;
            set;
        }

        public DateTime? Max
        {
            get;
            set;
        }

        public DateTime? Value
        {
            get;
            set;
        }

        public CalendarSelectionSettings SelectionSettings
        {
            get;
            set;
        }
        
        public override void WriteInitializationScript(TextWriter writer)
        {
            var options = new Dictionary<string, object>(Events);

            if (Value.HasValue)
            {
                options["value"] = Value;
            }

            if (Min.HasValue)
            {
                options["min"] = Min;
            }

            if (Max.HasValue)
            {
                options["max"] = Max;
            }

            if (Format.HasValue())
            {
                options["format"] = Format;
            }

            if (Footer.HasValue())
            {
                options["footer"] = Footer;
            }

            if (Depth.HasValue())
            {
                options["depth"] = Depth;
            }

            if (Start.HasValue())
            {
                options["start"] = Start;
            }

            var month = MonthTemplate.ToJson();

            if (month.Keys.Any())
            {
                options["month"] = month;
            }

            if (SelectionSettings.Dates.Any())
            {
                options["dates"] = SelectionSettings.Dates;
            }

            var url = SelectionSettings.GenerateUrl(ViewContext, urlGenerator);

            if (url.HasValue())
            {
                options["url"] = url;
            }

            writer.Write(Initializer.Initialize(Selector, "Calendar", options));

            base.WriteInitializationScript(writer);
        }

        protected override void WriteHtml(System.Web.UI.HtmlTextWriter writer)
        {
            CalendarHtmlBuilder builder = new CalendarHtmlBuilder(this);

            builder.Build().WriteTo(writer);

            base.WriteHtml(writer);
        }

        public override void VerifySettings()
        {
            base.VerifySettings();

            if (Min > Max)
            {
                throw new ArgumentException(TextResource.MinPropertyMustBeLessThenMaxProperty.FormatWith("Min", "Max"));
            }
        }
    }
}
